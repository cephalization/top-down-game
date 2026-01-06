/**
 * NetworkClient - WebSocket wrapper for client-server communication
 * Handles connection, reconnection, and message sending/receiving
 */

import type {
  ClientMessage,
  WelcomeMessage,
  StateMessage,
  ChunkMessage,
  PlayerJoinMessage,
  PlayerLeaveMessage,
  ChatBroadcastMessage,
  PongMessage,
  ErrorMessage,
  PlayerInput,
  DamageMessage,
  AttackResultMessage,
} from '../shared/protocol';
import { isServerMessage } from '../shared/protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface NetworkClientOptions {
  serverUrl: string;
  displayName: string;
  roomCode?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface NetworkClientEvents {
  onConnect?: (welcome: WelcomeMessage) => void;
  onDisconnect?: (reason: string) => void;
  onState?: (state: StateMessage) => void;
  onChunk?: (chunk: ChunkMessage) => void;
  onPlayerJoin?: (player: PlayerJoinMessage) => void;
  onPlayerLeave?: (leave: PlayerLeaveMessage) => void;
  onChat?: (chat: ChatBroadcastMessage) => void;
  onDamage?: (damage: DamageMessage) => void;
  onAttackResult?: (result: AttackResultMessage) => void;
  onPong?: (pong: PongMessage) => void;
  onError?: (error: ErrorMessage) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

export class NetworkClient {
  private ws: WebSocket | null = null;
  private options: Required<NetworkClientOptions>;
  private events: NetworkClientEvents = {};
  
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Connection info (populated after welcome)
  private playerId: string = '';
  private roomCode: string = '';
  private serverSeed: number = 0;
  private serverTick: number = 0;
  
  // Sequence number for inputs
  private inputSeq: number = 0;
  
  // RTT tracking
  private lastPingTime: number = 0;
  private rtt: number = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  
  constructor(options: NetworkClientOptions) {
    this.options = {
      serverUrl: options.serverUrl,
      displayName: options.displayName,
      roomCode: options.roomCode || '',
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    };
  }
  
  /**
   * Set event handlers
   */
  on(events: NetworkClientEvents): void {
    this.events = { ...this.events, ...events };
  }
  
  /**
   * Connect to the server
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.warn('[NetworkClient] Already connected or connecting');
      return;
    }
    
    this.setConnectionState('connecting');
    
    // Build WebSocket URL with query params
    const url = new URL(this.options.serverUrl);
    url.searchParams.set('name', this.options.displayName);
    if (this.options.roomCode) {
      url.searchParams.set('room', this.options.roomCode);
    }
    
    console.log(`[NetworkClient] Connecting to ${url.toString()}`);
    
    this.ws = new WebSocket(url.toString());
    
    this.ws.onopen = () => {
      console.log('[NetworkClient] WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
    };
    
    this.ws.onclose = (event) => {
      console.log(`[NetworkClient] WebSocket closed: ${event.code} ${event.reason}`);
      this.stopPingInterval();
      
      const wasConnected = this.connectionState === 'connected';
      this.setConnectionState('disconnected');
      
      this.events.onDisconnect?.(event.reason || 'Connection closed');
      
      // Attempt reconnection if appropriate
      if (wasConnected && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[NetworkClient] WebSocket error:', error);
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }
  
  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
  }
  
  /**
   * Send a player input to the server
   */
  sendInput(input: PlayerInput): number {
    const seq = ++this.inputSeq;
    
    this.send({
      type: 'input',
      seq,
      tick: this.serverTick,
      inputs: input,
    });
    
    return seq;
  }
  
  /**
   * Send a chat message
   */
  sendChat(message: string): void {
    this.send({
      type: 'chat',
      message,
    });
  }
  
  /**
   * Send an interact action
   */
  sendInteract(targetId: string): void {
    this.send({
      type: 'interact',
      targetId,
    });
  }
  
  /**
   * Send an attack action
   */
  sendAttack(direction: { x: number; y: number }, targetId?: string): void {
    this.send({
      type: 'attack',
      direction,
      targetId,
    });
  }
  
  /**
   * Join a different room
   */
  joinRoom(roomCode: string, displayName?: string): void {
    this.send({
      type: 'join',
      displayName: displayName || this.options.displayName,
      roomCode,
    });
  }
  
  /**
   * Send ping for RTT measurement
   */
  private sendPing(): void {
    this.lastPingTime = performance.now();
    this.send({
      type: 'ping',
      timestamp: this.lastPingTime,
    });
  }
  
  /**
   * Send a message to the server
   */
  private send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[NetworkClient] Cannot send - not connected');
      return;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[NetworkClient] Failed to send message:', error);
    }
  }
  
  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (!isServerMessage(message)) {
        console.warn('[NetworkClient] Received invalid message:', message);
        return;
      }
      
      switch (message.type) {
        case 'welcome':
          this.handleWelcome(message);
          break;
          
        case 'state':
          this.serverTick = message.tick;
          this.events.onState?.(message);
          break;
          
        case 'chunk':
          this.events.onChunk?.(message);
          break;
          
        case 'playerJoin':
          this.events.onPlayerJoin?.(message);
          break;
          
        case 'playerLeave':
          this.events.onPlayerLeave?.(message);
          break;
          
        case 'chatBroadcast':
          this.events.onChat?.(message);
          break;
          
        case 'damage':
          this.events.onDamage?.(message);
          break;
          
        case 'attackResult':
          this.events.onAttackResult?.(message);
          break;
          
        case 'pong':
          this.handlePong(message);
          break;
          
        case 'error':
          console.error('[NetworkClient] Server error:', message);
          this.events.onError?.(message);
          break;
      }
    } catch (error) {
      console.error('[NetworkClient] Failed to parse message:', error);
    }
  }
  
  /**
   * Handle welcome message
   */
  private handleWelcome(welcome: WelcomeMessage): void {
    this.playerId = welcome.playerId;
    this.roomCode = welcome.roomCode;
    this.serverSeed = welcome.seed;
    this.serverTick = welcome.tick;
    
    this.setConnectionState('connected');
    
    console.log(`[NetworkClient] Welcome! Player: ${this.playerId}, Room: ${this.roomCode}, Seed: ${this.serverSeed}`);
    
    this.events.onConnect?.(welcome);
  }
  
  /**
   * Handle pong message
   */
  private handlePong(pong: PongMessage): void {
    if (this.lastPingTime > 0) {
      this.rtt = performance.now() - this.lastPingTime;
    }
    
    this.events.onPong?.(pong);
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.log('[NetworkClient] Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');
    
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[NetworkClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }
  
  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Send ping every 5 seconds
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 5000);
    
    // Send initial ping
    this.sendPing();
  }
  
  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.events.onConnectionStateChange?.(state);
    }
  }
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
  
  getPlayerId(): string {
    return this.playerId;
  }
  
  getRoomCode(): string {
    return this.roomCode;
  }
  
  getServerSeed(): number {
    return this.serverSeed;
  }
  
  getServerTick(): number {
    return this.serverTick;
  }
  
  getRTT(): number {
    return this.rtt;
  }
  
  getCurrentInputSeq(): number {
    return this.inputSeq;
  }
}
