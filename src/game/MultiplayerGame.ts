/**
 * MultiplayerGame - Network-aware game class
 * Integrates client-side prediction, server reconciliation, and entity interpolation
 */

import type { GameConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { InputManager } from './InputManager';
import { Camera } from './Camera';
import { World } from '../world/World';
import { Player } from '../entities/Player';
import { RemotePlayer } from '../entities/RemotePlayer';
import { Renderer } from '../rendering/Renderer';
import { Rect } from '../utils/math';
import { DebugPanel } from './DebugPanel';
import {
  NetworkClient,
  InputBuffer,
  Reconciliation,
  createInputApplicator,
} from '../network';
import type {
  PlayerInput,
  StateMessage,
  ChunkMessage,
  WelcomeMessage,
  PlayerJoinMessage,
  ChatBroadcastMessage,
} from '../shared/protocol';
import { TICK_INTERVAL } from '../shared/protocol';

export interface MultiplayerGameCallbacks {
  onConnect?: (welcome: WelcomeMessage) => void;
  onDisconnect?: (reason: string) => void;
  onPlayerJoin?: (player: PlayerJoinMessage) => void;
  onPlayerLeave?: (playerId: string) => void;
  onChat?: (chat: ChatBroadcastMessage) => void;
  onUpdate?: (deltaTime: number) => void;
}

export interface MultiplayerGameOptions {
  serverUrl: string;
  displayName: string;
  roomCode?: string;
}

/**
 * MultiplayerGame - Multiplayer-aware game class
 */
export class MultiplayerGame {
  private config: GameConfig;
  private canvas: HTMLCanvasElement;
  private inputManager: InputManager;
  private camera: Camera;
  private world: World;
  private player: Player;
  private renderer: Renderer;
  private callbacks: MultiplayerGameCallbacks;
  private debugPanel: DebugPanel;
  
  // Networking
  private networkClient: NetworkClient;
  private inputBuffer: InputBuffer;
  private reconciliation: Reconciliation;
  private inputApplicator: (input: PlayerInput, x: number, y: number) => { x: number; y: number };
  
  // Remote players
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  
  // Game state
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  
  // Input sending rate limiter
  private lastInputSendTime: number = 0;
  private inputSendInterval: number = TICK_INTERVAL; // Send at same rate as server tick
  private lastSentInput: PlayerInput | null = null;
  
  // Performance tracking
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private frameTime: number = 0;
  
  // Debug
  private debugToggleDebounce: boolean = false;
  
  constructor(
    canvas: HTMLCanvasElement,
    options: MultiplayerGameOptions,
    config: Partial<GameConfig> = {},
    callbacks: MultiplayerGameCallbacks = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvas = canvas;
    this.callbacks = callbacks;
    
    // Initialize game systems
    this.inputManager = new InputManager();
    this.camera = new Camera();
    this.world = new World(this.config);
    this.player = new Player({ x: 0, y: 0 }, this.config.playerSpeed);
    this.renderer = new Renderer(canvas, this.camera);
    this.debugPanel = new DebugPanel();
    
    // Initialize networking systems
    this.inputBuffer = new InputBuffer();
    this.reconciliation = new Reconciliation();
    this.inputApplicator = createInputApplicator(
      this.config.playerSpeed,
      1.8, // Sprint multiplier
      TICK_INTERVAL / 1000 // Convert to seconds
    );
    
    // Initialize network client
    this.networkClient = new NetworkClient({
      serverUrl: options.serverUrl,
      displayName: options.displayName,
      roomCode: options.roomCode,
    });
    
    // Set up network event handlers
    this.setupNetworkHandlers();
    
    // Bind methods
    this.gameLoop = this.gameLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }
  
  /**
   * Set up network event handlers
   */
  private setupNetworkHandlers(): void {
    this.networkClient.on({
      onConnect: (welcome) => {
        console.log('[MultiplayerGame] Connected to server');
        this.player.setNetworkId(welcome.playerId);
        
        // Update world seed if different
        if (welcome.seed !== this.config.seed) {
          this.config.seed = welcome.seed;
          this.world = new World(this.config);
        }
        
        this.callbacks.onConnect?.(welcome);
      },
      
      onDisconnect: (reason) => {
        console.log('[MultiplayerGame] Disconnected from server:', reason);
        this.callbacks.onDisconnect?.(reason);
      },
      
      onState: (state) => {
        this.handleStateUpdate(state);
      },
      
      onChunk: (chunk) => {
        this.handleChunkData(chunk);
      },
      
      onPlayerJoin: (join) => {
        this.handlePlayerJoin(join);
      },
      
      onPlayerLeave: (leave) => {
        this.handlePlayerLeave(leave.playerId);
      },
      
      onChat: (chat) => {
        this.callbacks.onChat?.(chat);
      },
    });
  }
  
  /**
   * Handle state update from server
   */
  private handleStateUpdate(state: StateMessage): void {
    const localPlayerId = this.networkClient.getPlayerId();
    
    // Process each player in the state
    for (const playerState of state.players) {
      if (playerState.id === localPlayerId) {
        // Local player - reconcile with server
        const lastProcessedSeq = state.lastProcessedSeq[localPlayerId] ?? 0;
        
        const result = this.reconciliation.reconcile(
          playerState,
          lastProcessedSeq,
          this.inputBuffer,
          this.player.getPosition().x,
          this.player.getPosition().y,
          this.inputApplicator
        );
        
        if (result.correctionApplied) {
          this.player.snapToPosition(result.x, result.y);
        }
        
        // Update stats from server
        this.player.setStats(
          playerState.health,
          playerState.maxHealth,
          playerState.stamina,
          playerState.maxStamina
        );
      } else {
        // Remote player - add to interpolation buffer
        let remotePlayer = this.remotePlayers.get(playerState.id);
        
        if (!remotePlayer) {
          remotePlayer = new RemotePlayer(
            playerState.id,
            playerState.displayName,
            { x: playerState.x, y: playerState.y }
          );
          this.remotePlayers.set(playerState.id, remotePlayer);
        }
        
        remotePlayer.addServerState(playerState, state.serverTime);
      }
    }
    
    // Remove players that are no longer in the state
    const statePlayerIds = new Set(state.players.map(p => p.id));
    for (const [id] of this.remotePlayers) {
      if (!statePlayerIds.has(id) && id !== localPlayerId) {
        this.remotePlayers.delete(id);
      }
    }
  }
  
  /**
   * Handle chunk data from server
   */
  private handleChunkData(chunk: ChunkMessage): void {
    // Server sends chunk data for validation/synchronization
    // For now, we let the local world generate chunks deterministically
    // In a more sophisticated implementation, we'd inject server chunk data
    // by calling: deserializeChunkData(chunk.data)
    console.log(`[MultiplayerGame] Received chunk (${chunk.x}, ${chunk.y})`);
  }
  
  /**
   * Handle player join
   */
  private handlePlayerJoin(join: PlayerJoinMessage): void {
    const playerState = join.player;
    
    // Don't add ourselves
    if (playerState.id === this.networkClient.getPlayerId()) return;
    
    const remotePlayer = new RemotePlayer(
      playerState.id,
      playerState.displayName,
      { x: playerState.x, y: playerState.y }
    );
    
    this.remotePlayers.set(playerState.id, remotePlayer);
    
    console.log(`[MultiplayerGame] Player joined: ${playerState.displayName}`);
    this.callbacks.onPlayerJoin?.(join);
  }
  
  /**
   * Handle player leave
   */
  private handlePlayerLeave(playerId: string): void {
    this.remotePlayers.delete(playerId);
    
    console.log(`[MultiplayerGame] Player left: ${playerId}`);
    this.callbacks.onPlayerLeave?.(playerId);
  }
  
  /**
   * Start the game and connect to server
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    // Initialize input
    this.inputManager.initialize(this.canvas);
    
    // Set up resize handler
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
    
    // Initialize camera at player position
    this.camera.snapToTarget(this.player.getCenter());
    
    // Initial world update
    this.world.update(this.player.getPosition());
    
    // Connect to server
    this.networkClient.connect();
    
    // Start game loop
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }
  
  /**
   * Stop the game and disconnect from server
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    window.removeEventListener('resize', this.handleResize);
    this.inputManager.destroy();
    this.debugPanel.dispose();
    
    // Disconnect from server
    this.networkClient.disconnect();
    
    // Clear remote players
    this.remotePlayers.clear();
  }
  
  /**
   * Main game loop
   */
  private gameLoop(currentTime: number): void {
    if (!this.isRunning) return;
    
    // Calculate delta time
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    // Track frame time
    this.frameTime = deltaTime * 1000;
    
    // FPS calculation
    this.frameCount++;
    this.fpsTime += deltaTime;
    if (this.fpsTime >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTime = 0;
    }
    
    // Debug toggle (Ctrl+D)
    if (this.inputManager.isDebugTogglePressed()) {
      if (!this.debugToggleDebounce) {
        this.debugPanel.toggle();
        this.debugToggleDebounce = true;
      }
    } else {
      this.debugToggleDebounce = false;
    }
    
    // Update debug panel
    if (this.debugPanel.isVisible()) {
      this.updateDebugPanel();
    }
    
    if (!this.isPaused) {
      this.update(deltaTime, currentTime);
    }
    
    this.render();
    
    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }
  
  /**
   * Update game state
   */
  private update(deltaTime: number, currentTime: number): void {
    // Get player input
    const movement = this.inputManager.getMovementDirection();
    const sprinting = this.inputManager.isSprinting();
    
    // Create input object
    const input: PlayerInput = {
      dx: movement.x,
      dy: movement.y,
      sprint: sprinting,
    };
    
    // Store old position for collision
    const oldPosition = this.player.getPosition();
    
    // Apply input locally (prediction)
    this.player.setMovementInput(movement, sprinting);
    this.player.update(deltaTime);
    
    // Check collisions
    if (this.checkPlayerCollision()) {
      this.player.setPosition(oldPosition);
    }
    
    // Check walkability
    const playerCenter = this.player.getCenter();
    if (!this.world.isWalkable(playerCenter)) {
      this.player.setPosition(oldPosition);
    }
    
    // Send input to server (rate limited)
    if (currentTime - this.lastInputSendTime >= this.inputSendInterval) {
      // Only send if input changed or we have movement
      const inputChanged = !this.lastSentInput || 
        this.lastSentInput.dx !== input.dx ||
        this.lastSentInput.dy !== input.dy ||
        this.lastSentInput.sprint !== input.sprint;
      
      if (inputChanged || input.dx !== 0 || input.dy !== 0) {
        this.networkClient.sendInput(input);
        
        // Store in input buffer for reconciliation
        const pos = this.player.getPosition();
        this.inputBuffer.push(input, this.networkClient.getServerTick(), pos.x, pos.y);
        
        this.lastInputSendTime = currentTime;
        this.lastSentInput = { ...input };
      }
    }
    
    // Update remote players
    for (const remotePlayer of this.remotePlayers.values()) {
      remotePlayer.update(deltaTime);
    }
    
    // Update camera
    this.camera.setTarget(this.player.getCenter());
    this.camera.update(deltaTime);
    
    // Update world
    this.world.update(this.player.getPosition());
    
    // Callback
    this.callbacks.onUpdate?.(deltaTime);
  }
  
  /**
   * Check player collision
   */
  private checkPlayerCollision(): boolean {
    const playerBounds = this.player.getBounds();
    const nearbyEntities = this.world.getCollidableEntitiesNear(
      this.player.getCenter(),
      100
    );
    
    for (const entity of nearbyEntities) {
      if (Rect.intersects(playerBounds, entity.getBounds())) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Render the game
   */
  private render(): void {
    // Render world and local player
    this.renderer.render(this.world, this.player);
    
    // Render remote players
    const ctx = this.renderer.getContext();
    const cameraPos = this.camera.getPosition();
    const viewport = this.camera.getViewport();
    
    for (const remotePlayer of this.remotePlayers.values()) {
      const pos = remotePlayer.getPosition();
      
      // Check if in viewport
      if (
        pos.x + remotePlayer.getSize().x >= cameraPos.x - viewport.width / 2 &&
        pos.x <= cameraPos.x + viewport.width / 2 &&
        pos.y + remotePlayer.getSize().y >= cameraPos.y - viewport.height / 2 &&
        pos.y <= cameraPos.y + viewport.height / 2
      ) {
        const screenPos = {
          x: pos.x - cameraPos.x + viewport.width / 2,
          y: pos.y - cameraPos.y + viewport.height / 2,
        };
        remotePlayer.render(ctx, screenPos);
      }
    }
    
    // Render minimap
    const { width, height } = this.renderer.getDimensions();
    this.renderer.renderMinimap(this.world, this.player, width - 160, 10, 150);
    
    // Render FPS
    if (!this.debugPanel.isVisible()) {
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.fillText(`FPS: ${this.fps}`, 10, height - 10);
    }
    
    // Render connection status
    const connectionState = this.networkClient.getConnectionState();
    if (connectionState !== 'connected') {
      ctx.fillStyle = connectionState === 'connecting' ? '#fbbf24' : '#ef4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(
        connectionState === 'connecting' ? 'Connecting...' : 'Disconnected',
        10,
        30
      );
    } else {
      // Show RTT
      const rtt = this.networkClient.getRTT();
      ctx.fillStyle = '#22c55e';
      ctx.font = '12px monospace';
      ctx.fillText(`RTT: ${rtt.toFixed(0)}ms`, 10, 30);
    }
    
    // Render player count
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.fillText(`Players: ${this.remotePlayers.size + 1}`, 10, 50);
    
    // Render room code
    const roomCode = this.networkClient.getRoomCode();
    if (roomCode) {
      ctx.fillText(`Room: ${roomCode}`, 10, 70);
    }
  }
  
  /**
   * Update debug panel
   */
  private updateDebugPanel(): void {
    const playerPos = this.player.getPosition();
    const cameraPos = this.camera.getPosition();
    const viewport = this.camera.getViewport();
    const inputStats = this.inputBuffer.getStats();
    
    this.debugPanel.updateStats({
      fps: this.fps,
      frameTime: this.frameTime,
      avgFrameTime: this.frameTime,
      minFps: 0,
      maxFps: 0,
      chunks: this.world.getLoadedChunks().length,
      entities: this.world.getEntities().length,
      seed: this.config.seed,
      playerX: playerPos.x,
      playerY: playerPos.y,
      cameraX: cameraPos.x,
      cameraY: cameraPos.y,
      zoom: this.camera.getZoom(),
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      // Network stats
      rtt: this.networkClient.getRTT(),
      pendingInputs: inputStats.pendingCount,
      remotePlayers: this.remotePlayers.size,
    });
  }
  
  /**
   * Handle window resize
   */
  private handleResize(): void {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.renderer.resize(parent.clientWidth, parent.clientHeight);
    }
  }
  
  /**
   * Send chat message
   */
  sendChat(message: string): void {
    this.networkClient.sendChat(message);
  }
  
  /**
   * Get connection state
   */
  isConnected(): boolean {
    return this.networkClient.isConnected();
  }
  
  /**
   * Get room code
   */
  getRoomCode(): string {
    return this.networkClient.getRoomCode();
  }
  
  /**
   * Get player count (including self)
   */
  getPlayerCount(): number {
    return this.remotePlayers.size + 1;
  }
  
  /**
   * Get remote players
   */
  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }
  
  /**
   * Get local player
   */
  getPlayer(): Player {
    return this.player;
  }
  
  /**
   * Get world
   */
  getWorld(): World {
    return this.world;
  }
  
  /**
   * Get config
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }
  
  /**
   * Get network client
   */
  getNetworkClient(): NetworkClient {
    return this.networkClient;
  }
  
  /**
   * Pause game
   */
  pause(): void {
    this.isPaused = true;
  }
  
  /**
   * Resume game
   */
  resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
  }
  
  /**
   * Toggle pause
   */
  togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }
  
  /**
   * Check if paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }
  
  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}
