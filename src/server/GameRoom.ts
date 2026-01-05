/**
 * GameRoom - Manages a single multiplayer game room
 * Handles authoritative game state, player management, and tick-based simulation
 */

import type { ServerWebSocket } from 'bun';
import { ServerPlayer } from './ServerPlayer';
import type {
  ClientMessage,
  ServerMessage,
  StateMessage,
  PlayerJoinMessage,
  PlayerLeaveMessage,
  ChunkMessage,
  ChatBroadcastMessage,
  WelcomeMessage,
  PlayerInput,
  AttackMessage,
  DamageMessage,
  AttackResultMessage,
} from '../shared/protocol';
import { TICK_INTERVAL, serializeChunkData } from '../shared/protocol';
import { WorldManager } from './WorldManager';

export interface PlayerConnection {
  ws: ServerWebSocket<{ playerId: string; roomCode: string }>;
  player: ServerPlayer;
  lastInputTime: number;
  sentChunks: Set<string>;
}

export class GameRoom {
  readonly roomCode: string;
  readonly seed: number;
  
  private players: Map<string, PlayerConnection> = new Map();
  private worldManager: WorldManager;
  
  private tick: number = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;
  
  private isRunning: boolean = false;
  
  constructor(roomCode: string, seed?: number) {
    this.roomCode = roomCode;
    this.seed = seed ?? Math.floor(Math.random() * 1000000);
    this.worldManager = new WorldManager(this.seed);
  }
  
  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTickTime = Date.now();
    
    // Run game loop at TICK_RATE Hz
    this.tickInterval = setInterval(() => {
      this.gameTick();
    }, TICK_INTERVAL);
    
    console.log(`[GameRoom ${this.roomCode}] Started with seed ${this.seed}`);
  }
  
  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    
    console.log(`[GameRoom ${this.roomCode}] Stopped`);
  }
  
  /**
   * Add a player to the room
   */
  addPlayer(
    ws: ServerWebSocket<{ playerId: string; roomCode: string }>,
    playerId: string,
    displayName: string
  ): void {
    // Create server player
    const player = new ServerPlayer(playerId, displayName);
    
    // Set spawn position (could be randomized or based on spawn points)
    player.setPosition(0, 0);
    
    // Create connection record
    const connection: PlayerConnection = {
      ws,
      player,
      lastInputTime: Date.now(),
      sentChunks: new Set(),
    };
    
    this.players.set(playerId, connection);
    
    // Send welcome message
    const welcomeMsg: WelcomeMessage = {
      type: 'welcome',
      playerId,
      roomCode: this.roomCode,
      seed: this.seed,
      tick: this.tick,
      serverTime: Date.now(),
    };
    this.send(ws, welcomeMsg);
    
    // Send current state of all players
    this.sendStateToPlayer(connection);
    
    // Send initial chunks around spawn
    this.sendChunksAroundPlayer(connection);
    
    // Notify other players
    const joinMsg: PlayerJoinMessage = {
      type: 'playerJoin',
      player: player.getState(),
    };
    this.broadcastExcept(playerId, joinMsg);
    
    console.log(`[GameRoom ${this.roomCode}] Player ${displayName} (${playerId}) joined`);
    
    // Start game loop if this is the first player
    if (this.players.size === 1) {
      this.start();
    }
  }
  
  /**
   * Remove a player from the room
   */
  removePlayer(playerId: string): void {
    const connection = this.players.get(playerId);
    if (!connection) return;
    
    this.players.delete(playerId);
    
    // Notify other players
    const leaveMsg: PlayerLeaveMessage = {
      type: 'playerLeave',
      playerId,
    };
    this.broadcast(leaveMsg);
    
    console.log(`[GameRoom ${this.roomCode}] Player ${connection.player.displayName} (${playerId}) left`);
    
    // Stop game loop if no players
    if (this.players.size === 0) {
      this.stop();
    }
  }
  
  /**
   * Handle incoming message from a player
   */
  handleMessage(playerId: string, message: ClientMessage): void {
    const connection = this.players.get(playerId);
    if (!connection) return;
    
    switch (message.type) {
      case 'input':
        this.handleInput(connection, message.seq, message.inputs);
        break;
        
      case 'chat':
        this.handleChat(connection, message.message);
        break;
        
      case 'interact':
        this.handleInteract(connection, message.targetId);
        break;
        
      case 'attack':
        this.handleAttack(connection, message);
        break;
        
      case 'ping':
        this.send(connection.ws, {
          type: 'pong',
          timestamp: message.timestamp,
          serverTime: Date.now(),
        });
        break;
    }
  }
  
  /**
   * Handle player input
   */
  private handleInput(connection: PlayerConnection, seq: number, input: PlayerInput): void {
    connection.player.queueInput(seq, input);
    connection.lastInputTime = Date.now();
  }
  
  /**
   * Handle chat message
   */
  private handleChat(connection: PlayerConnection, message: string): void {
    // Sanitize message (basic)
    const sanitized = message.slice(0, 200).trim();
    if (!sanitized) return;
    
    const chatMsg: ChatBroadcastMessage = {
      type: 'chatBroadcast',
      playerId: connection.player.id,
      displayName: connection.player.displayName,
      message: sanitized,
      timestamp: Date.now(),
    };
    
    this.broadcast(chatMsg);
  }
  
  /**
   * Handle interact action
   */
  private handleInteract(_connection: PlayerConnection, _targetId: string): void {
    // TODO: Implement interaction system
    // Could be used for picking up items, opening doors, etc.
  }
  
  /**
   * Handle attack action
   */
  private handleAttack(connection: PlayerConnection, attack: AttackMessage): void {
    const attacker = connection.player;
    const attackRange = 50; // Attack range in pixels
    const attackDamage = 10;
    
    let targetHit: PlayerConnection | null = null;
    
    // If specific target provided, try to attack them
    if (attack.targetId) {
      const targetConn = this.players.get(attack.targetId);
      if (targetConn && targetConn.player.id !== attacker.id) {
        const dist = this.getDistance(attacker, targetConn.player);
        if (dist <= attackRange) {
          targetHit = targetConn;
        }
      }
    } else {
      // Find nearest player in attack direction
      let nearestDist = attackRange;
      
      for (const [id, conn] of this.players) {
        if (id === attacker.id) continue;
        
        const dx = conn.player.x - attacker.x;
        const dy = conn.player.y - attacker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > attackRange) continue;
        
        // Check if player is roughly in attack direction
        if (dist > 0) {
          const dirX = dx / dist;
          const dirY = dy / dist;
          const dot = dirX * attack.direction.x + dirY * attack.direction.y;
          
          // If player is in front (dot product > 0.5 means within ~60 degrees)
          if (dot > 0.5 && dist < nearestDist) {
            nearestDist = dist;
            targetHit = conn;
          }
        }
      }
    }
    
    // Apply damage if target found
    if (targetHit) {
      targetHit.player.takeDamage(attackDamage);
      
      // Send damage message to all players
      const damageMsg: DamageMessage = {
        type: 'damage',
        targetId: targetHit.player.id,
        amount: attackDamage,
        sourceId: attacker.id,
        newHealth: targetHit.player.health,
      };
      this.broadcast(damageMsg);
      
      // Send attack result to attacker
      const resultMsg: AttackResultMessage = {
        type: 'attackResult',
        attackerId: attacker.id,
        targetId: targetHit.player.id,
        hit: true,
        damage: attackDamage,
      };
      this.send(connection.ws, resultMsg);
      
      console.log(`[GameRoom ${this.roomCode}] ${attacker.displayName} hit ${targetHit.player.displayName} for ${attackDamage} damage`);
    } else {
      // Send miss result
      const resultMsg: AttackResultMessage = {
        type: 'attackResult',
        attackerId: attacker.id,
        targetId: null,
        hit: false,
        damage: 0,
      };
      this.send(connection.ws, resultMsg);
    }
  }
  
  /**
   * Get distance between two players
   */
  private getDistance(a: ServerPlayer, b: ServerPlayer): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Main game tick - runs at TICK_RATE Hz
   */
  private gameTick(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    this.tick++;
    
    // Process inputs for all players
    for (const connection of this.players.values()) {
      connection.player.processInputs(deltaTime);
      connection.player.update(deltaTime);
    }
    
    // TODO: Run collision detection
    // TODO: Process game events
    
    // Broadcast state to all players
    this.broadcastState();
    
    // Send new chunks to players who have moved
    for (const connection of this.players.values()) {
      this.sendChunksAroundPlayer(connection);
    }
  }
  
  /**
   * Broadcast game state to all players
   */
  private broadcastState(): void {
    // Collect all player states
    const playerStates = Array.from(this.players.values()).map(c => c.player.getState());
    
    // Build lastProcessedSeq map
    const lastProcessedSeq: Record<string, number> = {};
    for (const [id, connection] of this.players) {
      lastProcessedSeq[id] = connection.player.lastProcessedSeq;
    }
    
    const stateMsg: StateMessage = {
      type: 'state',
      tick: this.tick,
      serverTime: Date.now(),
      players: playerStates,
      lastProcessedSeq,
    };
    
    this.broadcast(stateMsg);
  }
  
  /**
   * Send current state to a specific player (used on join)
   */
  private sendStateToPlayer(connection: PlayerConnection): void {
    const playerStates = Array.from(this.players.values()).map(c => c.player.getState());
    
    const lastProcessedSeq: Record<string, number> = {};
    for (const [id, conn] of this.players) {
      lastProcessedSeq[id] = conn.player.lastProcessedSeq;
    }
    
    const stateMsg: StateMessage = {
      type: 'state',
      tick: this.tick,
      serverTime: Date.now(),
      players: playerStates,
      lastProcessedSeq,
    };
    
    this.send(connection.ws, stateMsg);
  }
  
  /**
   * Send chunks around a player's position
   */
  private sendChunksAroundPlayer(connection: PlayerConnection): void {
    const { x, y } = connection.player;
    const chunks = this.worldManager.getChunksAround(x, y);
    
    for (const chunk of chunks) {
      const key = `${chunk.x},${chunk.y}`;
      
      // Only send chunks not yet sent to this player
      if (!connection.sentChunks.has(key)) {
        const chunkMsg: ChunkMessage = {
          type: 'chunk',
          x: chunk.x,
          y: chunk.y,
          data: serializeChunkData(chunk),
        };
        
        this.send(connection.ws, chunkMsg);
        connection.sentChunks.add(key);
      }
    }
  }
  
  /**
   * Send message to a specific websocket
   */
  private send(ws: ServerWebSocket<{ playerId: string; roomCode: string }>, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[GameRoom ${this.roomCode}] Failed to send message:`, error);
    }
  }
  
  /**
   * Broadcast message to all players
   */
  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const connection of this.players.values()) {
      try {
        connection.ws.send(data);
      } catch (error) {
        console.error(`[GameRoom ${this.roomCode}] Failed to broadcast:`, error);
      }
    }
  }
  
  /**
   * Broadcast message to all players except one
   */
  private broadcastExcept(excludeId: string, message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [id, connection] of this.players) {
      if (id === excludeId) continue;
      try {
        connection.ws.send(data);
      } catch (error) {
        console.error(`[GameRoom ${this.roomCode}] Failed to broadcast:`, error);
      }
    }
  }
  
  /**
   * Get number of players in the room
   */
  getPlayerCount(): number {
    return this.players.size;
  }
  
  /**
   * Check if room is empty
   */
  isEmpty(): boolean {
    return this.players.size === 0;
  }
  
  /**
   * Get room info for lobby display
   */
  getInfo() {
    return {
      roomCode: this.roomCode,
      seed: this.seed,
      playerCount: this.players.size,
      players: Array.from(this.players.values()).map(c => ({
        id: c.player.id,
        displayName: c.player.displayName,
      })),
    };
  }
}
