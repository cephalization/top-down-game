/**
 * WorldManager - Server-side chunk generation and management
 * Generates chunks deterministically based on seed
 */

import type { ChunkData, Tile, TileType, EntityConfig } from '../types';
import { SimplexNoise, SeededRandom, getChunkKey, worldToChunk } from '../utils/math';
import { BIOMES, getBiomeFromNoise, generateEntitiesForPosition } from '../world/Biome';

// Default world configuration
const CHUNK_SIZE = 16;
const TILE_SIZE = 32;
const VIEW_DISTANCE = 2;

export class WorldManager {
  private seed: number;
  private chunks: Map<string, ChunkData> = new Map();
  
  // Noise generators for terrain
  private elevationNoise: SimplexNoise;
  private moistureNoise: SimplexNoise;
  private temperatureNoise: SimplexNoise;
  
  constructor(seed: number) {
    this.seed = seed;
    
    // Initialize noise generators with different seeds for variety
    this.elevationNoise = new SimplexNoise(seed);
    this.moistureNoise = new SimplexNoise(seed + 1000);
    this.temperatureNoise = new SimplexNoise(seed + 2000);
  }
  
  /**
   * Get chunks around a world position
   * Generates chunks if they don't exist
   */
  getChunksAround(worldX: number, worldY: number): ChunkData[] {
    const currentChunk = worldToChunk(
      { x: worldX, y: worldY },
      CHUNK_SIZE,
      TILE_SIZE
    );
    
    const chunks: ChunkData[] = [];
    
    for (let dy = -VIEW_DISTANCE; dy <= VIEW_DISTANCE; dy++) {
      for (let dx = -VIEW_DISTANCE; dx <= VIEW_DISTANCE; dx++) {
        const chunkX = currentChunk.x + dx;
        const chunkY = currentChunk.y + dy;
        const chunk = this.getOrGenerateChunk(chunkX, chunkY);
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }
  
  /**
   * Get or generate a specific chunk
   */
  getOrGenerateChunk(chunkX: number, chunkY: number): ChunkData {
    const key = getChunkKey(chunkX, chunkY);
    
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(chunkX, chunkY);
      this.chunks.set(key, chunk);
    }
    
    return chunk;
  }
  
  /**
   * Generate a chunk at the given coordinates
   */
  private generateChunk(chunkX: number, chunkY: number): ChunkData {
    const worldOffsetX = chunkX * CHUNK_SIZE;
    const worldOffsetY = chunkY * CHUNK_SIZE;
    
    // Calculate average biome values for chunk center to determine dominant biome
    const centerX = worldOffsetX + CHUNK_SIZE / 2;
    const centerY = worldOffsetY + CHUNK_SIZE / 2;
    const scale = 0.01; // Larger scale = bigger biomes
    
    const avgElevation = (this.elevationNoise.fbm(centerX * scale, centerY * scale) + 1) / 2;
    const avgMoisture = (this.moistureNoise.fbm(centerX * scale * 0.8, centerY * scale * 0.8) + 1) / 2;
    const avgTemperature = (this.temperatureNoise.fbm(centerX * scale * 0.5, centerY * scale * 0.5) + 1) / 2;
    
    const biome = getBiomeFromNoise(avgElevation, avgMoisture, avgTemperature);
    const biomeConfig = BIOMES[biome];
    
    // Create a seeded random for this chunk
    const chunkSeed = this.seed + chunkX * 73856093 + chunkY * 19349663;
    const random = new SeededRandom(chunkSeed);
    
    // Generate tiles
    const tiles: Tile[][] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = worldOffsetX + x;
        const worldY = worldOffsetY + y;
        
        // Get local noise values for tile variation
        const localElevation = (this.elevationNoise.fbm(worldX * 0.05, worldY * 0.05) + 1) / 2;
        
        // Determine tile type
        let tileType: TileType = biomeConfig.primaryTile;
        
        // Add some variation with secondary tile
        if (localElevation < 0.3 || random.chance(0.1)) {
          tileType = biomeConfig.secondaryTile;
        }
        
        // Check for water (very low elevation and high moisture)
        if (avgElevation < 0.25 && avgMoisture > 0.6 && localElevation < 0.2) {
          tileType = 'water';
        }
        
        tiles[y][x] = {
          type: tileType,
          position: { x: worldX, y: worldY },
          walkable: tileType !== 'water',
          elevation: localElevation,
        };
      }
    }
    
    // Generate entities
    const entities: EntityConfig[] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tile = tiles[y][x];
        
        // Only spawn entities on walkable tiles
        if (!tile.walkable) continue;
        
        const worldX = worldOffsetX + x;
        const worldY = worldOffsetY + y;
        
        // Create a unique random for this tile position
        const tileRandom = random.derive(worldX * 31 + worldY * 17);
        
        const newEntities = generateEntitiesForPosition(
          worldX,
          worldY,
          biomeConfig,
          tileRandom,
          TILE_SIZE
        );
        
        entities.push(...newEntities);
      }
    }
    
    return {
      x: chunkX,
      y: chunkY,
      tiles,
      entities,
      biome,
    };
  }
  
  /**
   * Check if a position is walkable
   */
  isWalkable(worldX: number, worldY: number): boolean {
    const chunkPos = worldToChunk({ x: worldX, y: worldY }, CHUNK_SIZE, TILE_SIZE);
    const chunk = this.getOrGenerateChunk(chunkPos.x, chunkPos.y);
    
    const chunkWorldX = chunkPos.x * CHUNK_SIZE * TILE_SIZE;
    const chunkWorldY = chunkPos.y * CHUNK_SIZE * TILE_SIZE;
    
    const localX = Math.floor((worldX - chunkWorldX) / TILE_SIZE);
    const localY = Math.floor((worldY - chunkWorldY) / TILE_SIZE);
    
    if (localX < 0 || localX >= CHUNK_SIZE || localY < 0 || localY >= CHUNK_SIZE) {
      return false;
    }
    
    return chunk.tiles[localY]?.[localX]?.walkable ?? false;
  }
  
  /**
   * Get the seed
   */
  getSeed(): number {
    return this.seed;
  }
  
  /**
   * Clear all cached chunks (useful for memory management)
   */
  clearCache(): void {
    this.chunks.clear();
  }
  
  /**
   * Prune chunks far from a position
   */
  pruneDistantChunks(worldX: number, worldY: number, keepDistance: number = 5): number {
    const currentChunk = worldToChunk({ x: worldX, y: worldY }, CHUNK_SIZE, TILE_SIZE);
    const toRemove: string[] = [];
    
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.x - currentChunk.x);
      const dy = Math.abs(chunk.y - currentChunk.y);
      if (dx > keepDistance || dy > keepDistance) {
        toRemove.push(key);
      }
    }
    
    for (const key of toRemove) {
      this.chunks.delete(key);
    }
    
    return toRemove.length;
  }
}
