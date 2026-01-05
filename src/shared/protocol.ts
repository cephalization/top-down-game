/**
 * Shared protocol types for client-server communication
 * Used by both the Bun WebSocket server and the browser client
 */

import type { ChunkData, BiomeType, Tile, EntityConfig } from '../types';

// ============================================================================
// Player Input (Client -> Server)
// ============================================================================

export interface PlayerInput {
  dx: number;      // -1 to 1 (horizontal movement)
  dy: number;      // -1 to 1 (vertical movement)
  sprint: boolean;
  attack?: boolean;
}

// ============================================================================
// Player State (Server -> Client)
// ============================================================================

export interface PlayerState {
  id: string;
  displayName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  direction: { x: number; y: number };
}

// ============================================================================
// Client -> Server Messages
// ============================================================================

export interface JoinMessage {
  type: 'join';
  displayName: string;
  roomCode?: string;
}

export interface InputMessage {
  type: 'input';
  seq: number;      // Sequence number for reconciliation
  tick: number;     // Client tick when input was generated
  inputs: PlayerInput;
}

export interface ChatMessage {
  type: 'chat';
  message: string;
}

export interface InteractMessage {
  type: 'interact';
  targetId: string;
}

export interface AttackMessage {
  type: 'attack';
  targetId?: string;  // Optional - if provided, attacks specific player
  direction: { x: number; y: number };
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export type ClientMessage =
  | JoinMessage
  | InputMessage
  | ChatMessage
  | InteractMessage
  | AttackMessage
  | PingMessage;

// ============================================================================
// Server -> Client Messages
// ============================================================================

export interface WelcomeMessage {
  type: 'welcome';
  playerId: string;
  roomCode: string;
  seed: number;
  tick: number;
  serverTime: number;
}

export interface StateMessage {
  type: 'state';
  tick: number;
  serverTime: number;
  players: PlayerState[];
  // Map of playerId -> lastProcessedSeq for reconciliation
  lastProcessedSeq: Record<string, number>;
}

export interface ChunkMessage {
  type: 'chunk';
  x: number;
  y: number;
  data: SerializedChunkData;
}

export interface PlayerJoinMessage {
  type: 'playerJoin';
  player: PlayerState;
}

export interface PlayerLeaveMessage {
  type: 'playerLeave';
  playerId: string;
}

export interface ChatBroadcastMessage {
  type: 'chatBroadcast';
  playerId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

export interface DamageMessage {
  type: 'damage';
  targetId: string;
  amount: number;
  sourceId: string;
  newHealth: number;
}

export interface AttackResultMessage {
  type: 'attackResult';
  attackerId: string;
  targetId: string | null;
  hit: boolean;
  damage: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
  serverTime: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | StateMessage
  | ChunkMessage
  | PlayerJoinMessage
  | PlayerLeaveMessage
  | ChatBroadcastMessage
  | DamageMessage
  | AttackResultMessage
  | PongMessage
  | ErrorMessage;

// ============================================================================
// Serialized Types (for network transmission)
// ============================================================================

export interface SerializedTile {
  type: string;
  x: number;
  y: number;
  walkable: boolean;
  elevation: number;
}

export interface SerializedChunkData {
  x: number;
  y: number;
  tiles: SerializedTile[][];
  entities: EntityConfig[];
  biome: BiomeType;
}

// ============================================================================
// Helper functions for serialization
// ============================================================================

export function serializeChunkData(chunk: ChunkData): SerializedChunkData {
  return {
    x: chunk.x,
    y: chunk.y,
    tiles: chunk.tiles.map(row =>
      row.map(tile => ({
        type: tile.type,
        x: tile.position.x,
        y: tile.position.y,
        walkable: tile.walkable,
        elevation: tile.elevation,
      }))
    ),
    entities: chunk.entities,
    biome: chunk.biome,
  };
}

export function deserializeChunkData(data: SerializedChunkData): ChunkData {
  return {
    x: data.x,
    y: data.y,
    tiles: data.tiles.map(row =>
      row.map(tile => ({
        type: tile.type as Tile['type'],
        position: { x: tile.x, y: tile.y },
        walkable: tile.walkable,
        elevation: tile.elevation,
      }))
    ),
    entities: data.entities,
    biome: data.biome,
  };
}

// ============================================================================
// Constants
// ============================================================================

export const TICK_RATE = 20;                    // Server ticks per second (20 Hz)
export const TICK_INTERVAL = 1000 / TICK_RATE;  // 50ms per tick
export const INTERPOLATION_DELAY = 100;          // 100ms render delay for interpolation
export const MAX_PENDING_INPUTS = 60;            // Maximum inputs to keep for reconciliation
export const INPUT_SEND_RATE = 20;               // Input messages per second

// ============================================================================
// Type guards
// ============================================================================

export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'join' ||
    m.type === 'input' ||
    m.type === 'chat' ||
    m.type === 'interact' ||
    m.type === 'attack' ||
    m.type === 'ping'
  );
}

export function isServerMessage(msg: unknown): msg is ServerMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'welcome' ||
    m.type === 'state' ||
    m.type === 'chunk' ||
    m.type === 'playerJoin' ||
    m.type === 'playerLeave' ||
    m.type === 'chatBroadcast' ||
    m.type === 'damage' ||
    m.type === 'attackResult' ||
    m.type === 'pong' ||
    m.type === 'error'
  );
}
