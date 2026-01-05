// Core type definitions for the exploration game

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EntityConfig {
  id: string;
  position: Vector2;
  size: Vector2;
  type: EntityType;
  collidable?: boolean;
  interactable?: boolean;
}

export type EntityType = 
  | 'player'
  | 'tree'
  | 'rock'
  | 'bush'
  | 'flower'
  | 'collectible'
  | 'water'
  | 'custom';

export type TileType = 
  | 'grass'
  | 'dirt'
  | 'sand'
  | 'water'
  | 'stone'
  | 'snow';

export type BiomeType = 
  | 'plains'
  | 'forest'
  | 'desert'
  | 'mountains'
  | 'tundra';

export interface Tile {
  type: TileType;
  position: Vector2;
  walkable: boolean;
  elevation: number;
}

export interface ChunkData {
  x: number;
  y: number;
  tiles: Tile[][];
  entities: EntityConfig[];
  biome: BiomeType;
}

export interface GameState {
  isPaused: boolean;
  isRunning: boolean;
  playerPosition: Vector2;
  cameraPosition: Vector2;
  loadedChunks: Map<string, ChunkData>;
}

export interface InputState {
  keys: Set<string>;
  mousePosition: Vector2;
  mouseButtons: Set<number>;
}

export interface GameConfig {
  tileSize: number;
  chunkSize: number;
  viewDistance: number;
  playerSpeed: number;
  seed: number;
}

// Color palette for tiles
export const TILE_COLORS: Record<TileType, string> = {
  grass: '#4ade80',
  dirt: '#a16207',
  sand: '#fcd34d',
  water: '#38bdf8',
  stone: '#78716c',
  snow: '#f1f5f9',
};

// Default game configuration
export const DEFAULT_CONFIG: GameConfig = {
  tileSize: 32,
  chunkSize: 16,
  viewDistance: 2,
  playerSpeed: 200,
  seed: Date.now(),
};
