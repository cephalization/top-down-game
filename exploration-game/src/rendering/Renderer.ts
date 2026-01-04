import type { Rectangle, Vector2 } from '../types';
import { TILE_COLORS } from '../types';
import { Camera } from '../game/Camera';
import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Entity } from '../entities/Entity';

/**
 * Main rendering system
 * Handles all canvas drawing operations
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private width: number = 0;
  private height: number = 0;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;
    this.camera = camera;

    // Disable image smoothing for pixel-art style
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Resize canvas to fit container
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.setViewport(width, height);
    
    // Re-disable after resize
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Render the entire game scene
   */
  render(world: World, player: Player): void {
    this.clear();

    const viewBounds = this.camera.getViewBounds();
    const config = world.getConfig();

    // Render terrain
    this.renderTerrain(world, viewBounds, config.tileSize);

    // Collect all renderable objects and sort by Y position for proper layering
    const renderables: { entity: Entity | Player; y: number }[] = [];

    // Add world entities
    world.getEntities().forEach(entity => {
      if (this.isInView(entity.getPosition(), entity.getSize(), viewBounds)) {
        renderables.push({
          entity,
          y: entity.getPosition().y + entity.getSize().y,
        });
      }
    });

    // Add player
    renderables.push({
      entity: player,
      y: player.getPosition().y + player.getSize().y,
    });

    // Sort by Y position (entities with lower Y render first)
    renderables.sort((a, b) => a.y - b.y);

    // Render all entities
    renderables.forEach(({ entity }) => {
      const screenPos = this.camera.worldToScreen(entity.getPosition());
      entity.render(this.ctx, screenPos);
    });

    // Render debug info if needed
    // this.renderDebug(world, player);
  }

  /**
   * Render terrain tiles
   */
  private renderTerrain(world: World, viewBounds: Rectangle, tileSize: number): void {
    const chunks = world.getLoadedChunks();
    const zoom = this.camera.getZoom();

    chunks.forEach(chunk => {
      const tiles = chunk.getTiles();
      const chunkWorldPos = chunk.getWorldPosition();

      tiles.forEach((row, tileY) => {
        row.forEach((tile, tileX) => {
          const worldX = chunkWorldPos.x + tileX * tileSize;
          const worldY = chunkWorldPos.y + tileY * tileSize;

          // Skip tiles outside view
          if (
            worldX + tileSize < viewBounds.x ||
            worldX > viewBounds.x + viewBounds.width ||
            worldY + tileSize < viewBounds.y ||
            worldY > viewBounds.y + viewBounds.height
          ) {
            return;
          }

          const screenPos = this.camera.worldToScreen({ x: worldX, y: worldY });
          const renderSize = tileSize * zoom;

          // Draw tile
          this.ctx.fillStyle = TILE_COLORS[tile.type];
          this.ctx.fillRect(
            Math.floor(screenPos.x),
            Math.floor(screenPos.y),
            Math.ceil(renderSize) + 1, // +1 to avoid gaps
            Math.ceil(renderSize) + 1
          );

          // Add subtle variation based on elevation
          const shade = (tile.elevation - 0.5) * 20;
          if (shade > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${shade / 100})`;
          } else {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${-shade / 100})`;
          }
          this.ctx.fillRect(
            Math.floor(screenPos.x),
            Math.floor(screenPos.y),
            Math.ceil(renderSize) + 1,
            Math.ceil(renderSize) + 1
          );
        });
      });
    });
  }

  /**
   * Check if a position is within the view bounds
   */
  private isInView(position: Vector2, size: Vector2, viewBounds: Rectangle): boolean {
    return !(
      position.x + size.x < viewBounds.x ||
      position.x > viewBounds.x + viewBounds.width ||
      position.y + size.y < viewBounds.y ||
      position.y > viewBounds.y + viewBounds.height
    );
  }

  /**
   * Render debug information
   */
  renderDebug(world: World, player: Player): void {
    const playerPos = player.getPosition();
    const chunks = world.getLoadedChunks();

    this.ctx.fillStyle = 'white';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`Position: ${Math.floor(playerPos.x)}, ${Math.floor(playerPos.y)}`, 10, 20);
    this.ctx.fillText(`Chunks loaded: ${chunks.length}`, 10, 40);
    this.ctx.fillText(`Entities: ${world.getEntities().length}`, 10, 60);

    // Draw chunk boundaries
    const config = world.getConfig();
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1;

    chunks.forEach(chunk => {
      const worldPos = chunk.getWorldPosition();
      const screenPos = this.camera.worldToScreen(worldPos);
      const size = config.chunkSize * config.tileSize * this.camera.getZoom();

      this.ctx.strokeRect(screenPos.x, screenPos.y, size, size);
    });
  }

  /**
   * Render a simple minimap
   */
  renderMinimap(world: World, player: Player, x: number, y: number, size: number): void {
    const config = world.getConfig();
    const chunks = world.getLoadedChunks();
    const playerPos = player.getPosition();

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(x, y, size, size);

    // Border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, size, size);

    // Calculate scale
    const worldSize = config.chunkSize * config.tileSize * (config.viewDistance * 2 + 1);
    const scale = size / worldSize;

    // Draw chunks
    chunks.forEach(chunk => {
      const chunkWorldPos = chunk.getWorldPosition();
      const relX = (chunkWorldPos.x - playerPos.x + worldSize / 2) * scale;
      const relY = (chunkWorldPos.y - playerPos.y + worldSize / 2) * scale;
      const chunkSize = config.chunkSize * config.tileSize * scale;

      // Get biome color
      const biomeColors: Record<string, string> = {
        plains: '#4ade80',
        forest: '#166534',
        desert: '#fcd34d',
        mountains: '#78716c',
        tundra: '#e2e8f0',
      };

      this.ctx.fillStyle = biomeColors[chunk.getBiome()] ?? '#888';
      this.ctx.fillRect(x + relX, y + relY, chunkSize, chunkSize);
    });

    // Draw player dot
    this.ctx.fillStyle = '#3b82f6';
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y + size / 2, 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Get canvas context (for custom rendering)
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
