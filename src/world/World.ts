import type { Vector2, GameConfig, Tile } from '../types';
import { Chunk } from './Chunk';
import { SimplexNoise, getChunkKey, worldToChunk } from '../utils/math';
import { Entity } from '../entities/Entity';
import { Tree } from '../entities/environment/Tree';
import { Rock } from '../entities/environment/Rock';
import { Bush } from '../entities/environment/Bush';
import { Flower } from '../entities/environment/Flower';

/**
 * World manager - handles chunk loading/unloading and entity management
 */
export class World {
  private chunks: Map<string, Chunk> = new Map();
  private entities: Map<string, Entity> = new Map();
  private config: GameConfig;
  
  // Noise generators for terrain
  private elevationNoise: SimplexNoise;
  private moistureNoise: SimplexNoise;
  private temperatureNoise: SimplexNoise;

  constructor(config: GameConfig) {
    this.config = config;
    
    // Initialize noise generators with different seeds for variety
    this.elevationNoise = new SimplexNoise(config.seed);
    this.moistureNoise = new SimplexNoise(config.seed + 1000);
    this.temperatureNoise = new SimplexNoise(config.seed + 2000);
  }

  /**
   * Update world state - load/unload chunks based on player position
   */
  update(playerPosition: Vector2): void {
    const currentChunk = worldToChunk(
      playerPosition,
      this.config.chunkSize,
      this.config.tileSize
    );

    // Determine which chunks should be loaded
    const chunksToLoad = new Set<string>();
    const viewDist = this.config.viewDistance;

    for (let dy = -viewDist; dy <= viewDist; dy++) {
      for (let dx = -viewDist; dx <= viewDist; dx++) {
        const chunkX = currentChunk.x + dx;
        const chunkY = currentChunk.y + dy;
        chunksToLoad.add(getChunkKey(chunkX, chunkY));
      }
    }

    // Load new chunks
    chunksToLoad.forEach(key => {
      if (!this.chunks.has(key)) {
        this.loadChunk(key);
      }
    });

    // Unload distant chunks
    const chunksToUnload: string[] = [];
    this.chunks.forEach((_chunk, key) => {
      if (!chunksToLoad.has(key)) {
        chunksToUnload.push(key);
      }
    });

    chunksToUnload.forEach(key => {
      this.unloadChunk(key);
    });
  }

  /**
   * Load a chunk
   */
  private loadChunk(key: string): void {
    const [x, y] = key.split(',').map(Number);
    
    const chunk = new Chunk(x, y, this.config.chunkSize, this.config.tileSize);
    chunk.generate(
      this.elevationNoise,
      this.moistureNoise,
      this.temperatureNoise,
      this.config.seed
    );

    this.chunks.set(key, chunk);

    // Create entity instances from chunk entity configs
    const loadedChunk = this.chunks.get(key);
    loadedChunk?.getEntities().forEach(config => {
      if (this.entities.has(config.id)) return;

      let entity: Entity | null = null;

      switch (config.type) {
        case 'tree':
          // Extract variant from ID or use default
          entity = new Tree(config.position, 'oak', 1);
          break;
        case 'rock':
          entity = new Rock(config.position, 'medium');
          break;
        case 'bush':
          entity = new Bush(config.position, 'green');
          break;
        case 'flower':
          entity = new Flower(config.position, 'yellow');
          break;
      }

      if (entity) {
        this.entities.set(config.id, entity);
      }
    });
  }

  /**
   * Unload a chunk
   */
  private unloadChunk(key: string): void {
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    // Remove entities that belong to this chunk
    chunk.getEntities().forEach(config => {
      this.entities.delete(config.id);
    });

    this.chunks.delete(key);
  }

  /**
   * Get all loaded chunks
   */
  getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunk at world position
   */
  getChunkAt(worldPos: Vector2): Chunk | null {
    const chunkPos = worldToChunk(
      worldPos,
      this.config.chunkSize,
      this.config.tileSize
    );
    return this.chunks.get(getChunkKey(chunkPos.x, chunkPos.y)) ?? null;
  }

  /**
   * Get tile at world position
   */
  getTileAt(worldPos: Vector2): Tile | null {
    const chunk = this.getChunkAt(worldPos);
    if (!chunk) return null;

    const chunkWorldPos = chunk.getWorldPosition();
    const localX = Math.floor((worldPos.x - chunkWorldPos.x) / this.config.tileSize);
    const localY = Math.floor((worldPos.y - chunkWorldPos.y) / this.config.tileSize);

    return chunk.getTile(localX, localY);
  }

  /**
   * Check if a position is walkable
   */
  isWalkable(worldPos: Vector2): boolean {
    const tile = this.getTileAt(worldPos);
    return tile?.walkable ?? false;
  }

  /**
   * Get all active entities
   */
  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities within a radius of a position
   */
  getEntitiesNear(position: Vector2, radius: number): Entity[] {
    return this.getEntities().filter(entity => {
      const dist = Math.sqrt(
        Math.pow(entity.getPosition().x - position.x, 2) +
        Math.pow(entity.getPosition().y - position.y, 2)
      );
      return dist <= radius;
    });
  }

  /**
   * Get collidable entities within a radius
   */
  getCollidableEntitiesNear(position: Vector2, radius: number): Entity[] {
    return this.getEntitiesNear(position, radius).filter(e => e.collidable);
  }

  /**
   * Get game config
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Get seed
   */
  getSeed(): number {
    return this.config.seed;
  }
}
