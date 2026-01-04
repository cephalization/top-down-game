import type { Vector2, Rectangle } from '../types';
import { Vec2, lerp, clamp } from '../utils/math';

/**
 * Camera system for viewport management
 * Follows the player with smooth interpolation
 */
export class Camera {
  private position: Vector2 = { x: 0, y: 0 };
  private targetPosition: Vector2 = { x: 0, y: 0 };
  private viewport: { width: number; height: number } = { width: 800, height: 600 };
  private zoom: number = 1;
  private smoothing: number = 0.1; // Lower = smoother, higher = snappier

  /**
   * Update camera position to follow target
   */
  update(deltaTime: number): void {
    // Smooth follow using lerp
    const t = 1 - Math.pow(1 - this.smoothing, deltaTime * 60);
    this.position.x = lerp(this.position.x, this.targetPosition.x, t);
    this.position.y = lerp(this.position.y, this.targetPosition.y, t);
  }

  /**
   * Set the target position for the camera to follow
   * Usually the player's center position
   */
  setTarget(target: Vector2): void {
    this.targetPosition = Vec2.clone(target);
  }

  /**
   * Immediately snap camera to target (no smoothing)
   */
  snapToTarget(target: Vector2): void {
    this.position = Vec2.clone(target);
    this.targetPosition = Vec2.clone(target);
  }

  /**
   * Set viewport dimensions
   */
  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  /**
   * Get current camera position (center of viewport in world coordinates)
   */
  getPosition(): Vector2 {
    return Vec2.clone(this.position);
  }

  /**
   * Get the visible world rectangle
   */
  getViewBounds(): Rectangle {
    const halfWidth = (this.viewport.width / 2) / this.zoom;
    const halfHeight = (this.viewport.height / 2) / this.zoom;
    
    return {
      x: this.position.x - halfWidth,
      y: this.position.y - halfHeight,
      width: (this.viewport.width) / this.zoom,
      height: (this.viewport.height) / this.zoom,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldPos: Vector2): Vector2 {
    const halfWidth = this.viewport.width / 2;
    const halfHeight = this.viewport.height / 2;
    
    return {
      x: (worldPos.x - this.position.x) * this.zoom + halfWidth,
      y: (worldPos.y - this.position.y) * this.zoom + halfHeight,
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenPos: Vector2): Vector2 {
    const halfWidth = this.viewport.width / 2;
    const halfHeight = this.viewport.height / 2;
    
    return {
      x: (screenPos.x - halfWidth) / this.zoom + this.position.x,
      y: (screenPos.y - halfHeight) / this.zoom + this.position.y,
    };
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, 0.25, 4);
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Adjust zoom by a delta amount
   */
  adjustZoom(delta: number): void {
    this.setZoom(this.zoom + delta);
  }

  /**
   * Set camera smoothing (0-1, lower = smoother)
   */
  setSmoothing(smoothing: number): void {
    this.smoothing = clamp(smoothing, 0.01, 1);
  }

  /**
   * Get viewport dimensions
   */
  getViewport(): { width: number; height: number } {
    return { ...this.viewport };
  }
}
