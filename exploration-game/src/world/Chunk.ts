import type { ChunkData, Tile, BiomeType, TileType, EntityConfig, Vector2 } from '../types';
import { SimplexNoise, SeededRandom, getChunkKey } from '../utils/math';
import { BIOMES, getBiomeFromNoise, generateEntitiesForPosition } from './Biome';

/**
 * Represents a chunk of the world
 * Chunks are generated procedurally and cached
 */
export class Chunk {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly tileSize: number;
  readonly key: string;
  
  private tiles: Tile[][];
  private entities: EntityConfig[];
  private biome: BiomeType;
  private isGenerated: boolean = false;

  constructor(chunkX: number, chunkY: number, size: number, tileSize: number) {
    this.x = chunkX;
    this.y = chunkY;
    this.size = size;
    this.tileSize = tileSize;
    this.key = getChunkKey(chunkX, chunkY);
    this.tiles = [];
    this.entities = [];
    this.biome = 'plains';
  }

  /**
   * Generate chunk content using noise
   */
  generate(
    elevationNoise: SimplexNoise,
    moistureNoise: SimplexNoise,
    temperatureNoise: SimplexNoise,
    seed: number
  ): void {
    if (this.isGenerated) return;

    const worldOffsetX = this.x * this.size;
    const worldOffsetY = this.y * this.size;

    // Calculate average biome values for chunk center to determine dominant biome
    const centerX = worldOffsetX + this.size / 2;
    const centerY = worldOffsetY + this.size / 2;
    const scale = 0.01; // Larger scale = bigger biomes

    const avgElevation = (elevationNoise.fbm(centerX * scale, centerY * scale) + 1) / 2;
    const avgMoisture = (moistureNoise.fbm(centerX * scale * 0.8, centerY * scale * 0.8) + 1) / 2;
    const avgTemperature = (temperatureNoise.fbm(centerX * scale * 0.5, centerY * scale * 0.5) + 1) / 2;

    this.biome = getBiomeFromNoise(avgElevation, avgMoisture, avgTemperature);
    const biomeConfig = BIOMES[this.biome];

    // Create a seeded random for this chunk
    const chunkSeed = seed + this.x * 73856093 + this.y * 19349663;
    const random = new SeededRandom(chunkSeed);

    // Generate tiles
    this.tiles = [];
    for (let y = 0; y < this.size; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.size; x++) {
        const worldX = worldOffsetX + x;
        const worldY = worldOffsetY + y;

        // Get local noise values for tile variation
        const localElevation = (elevationNoise.fbm(worldX * 0.05, worldY * 0.05) + 1) / 2;
        
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

        this.tiles[y][x] = {
          type: tileType,
          position: { x: worldX, y: worldY },
          walkable: tileType !== 'water',
          elevation: localElevation,
        };
      }
    }

    // Generate entities
    this.entities = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const tile = this.tiles[y][x];
        
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
          this.tileSize
        );
        
        this.entities.push(...newEntities);
      }
    }

    this.isGenerated = true;
  }

  /**
   * Get chunk data for serialization
   */
  getData(): ChunkData {
    return {
      x: this.x,
      y: this.y,
      tiles: this.tiles,
      entities: this.entities,
      biome: this.biome,
    };
  }

  /**
   * Get tile at local coordinates
   */
  getTile(localX: number, localY: number): Tile | null {
    if (localX < 0 || localX >= this.size || localY < 0 || localY >= this.size) {
      return null;
    }
    return this.tiles[localY]?.[localX] ?? null;
  }

  /**
   * Get all tiles
   */
  getTiles(): Tile[][] {
    return this.tiles;
  }

  /**
   * Get all entities in this chunk
   */
  getEntities(): EntityConfig[] {
    return this.entities;
  }

  /**
   * Get biome type
   */
  getBiome(): BiomeType {
    return this.biome;
  }

  /**
   * Get world position of chunk's top-left corner
   */
  getWorldPosition(): Vector2 {
    return {
      x: this.x * this.size * this.tileSize,
      y: this.y * this.size * this.tileSize,
    };
  }

  /**
   * Check if chunk has been generated
   */
  hasGenerated(): boolean {
    return this.isGenerated;
  }
}
