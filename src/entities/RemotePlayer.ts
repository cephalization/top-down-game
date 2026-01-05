/**
 * RemotePlayer - Represents another player in multiplayer
 * Uses interpolation for smooth rendering
 */

import { Entity } from './Entity';
import type { Vector2 } from '../types';
import type { PlayerState } from '../shared/protocol';
import { InterpolationBuffer, type InterpolatedState } from '../network/InterpolationBuffer';

export class RemotePlayer extends Entity {
  readonly playerId: string;
  displayName: string;
  
  private interpolationBuffer: InterpolationBuffer;
  private currentState: InterpolatedState | null = null;
  
  private direction: Vector2 = { x: 0, y: 1 };
  private animationFrame: number = 0;
  private animationTimer: number = 0;
  private isMoving: boolean = false;
  
  // Stats for display
  private health: number = 100;
  private maxHealth: number = 100;
  
  constructor(playerId: string, displayName: string, position: Vector2 = { x: 0, y: 0 }) {
    super({
      id: playerId,
      position,
      size: { x: 28, y: 28 },
      type: 'player',
      collidable: false, // Don't collide with remote players
      interactable: false,
    });
    
    this.playerId = playerId;
    this.displayName = displayName;
    this.interpolationBuffer = new InterpolationBuffer();
  }
  
  /**
   * Add a state update from the server
   */
  addServerState(state: PlayerState, serverTime: number): void {
    this.interpolationBuffer.addState(state, serverTime);
    this.displayName = state.displayName;
    this.health = state.health;
    this.maxHealth = state.maxHealth;
  }
  
  /**
   * Update remote player state
   */
  update(deltaTime: number): void {
    // Get interpolated state
    this.currentState = this.interpolationBuffer.getInterpolatedState();
    
    if (this.currentState) {
      // Update position from interpolated state
      this.position.x = this.currentState.x;
      this.position.y = this.currentState.y;
      
      // Update velocity
      this.velocity.x = this.currentState.vx;
      this.velocity.y = this.currentState.vy;
      
      // Update direction
      this.direction = { ...this.currentState.direction };
      
      // Update stats
      this.health = this.currentState.health;
      this.maxHealth = this.currentState.maxHealth;
      
      // Check if moving
      const speed = Math.sqrt(
        this.currentState.vx * this.currentState.vx + 
        this.currentState.vy * this.currentState.vy
      );
      this.isMoving = speed > 10;
    }
    
    // Update animation
    if (this.isMoving) {
      this.animationTimer += deltaTime;
      if (this.animationTimer > 0.15) {
        this.animationTimer = 0;
        this.animationFrame = (this.animationFrame + 1) % 4;
      }
    } else {
      this.animationFrame = 0;
      this.animationTimer = 0;
    }
  }
  
  /**
   * Render remote player
   */
  render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void {
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(
      screenPos.x + this.size.x / 2,
      screenPos.y + this.size.y + 2,
      this.size.x / 2.5,
      4,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Draw player body
    const bobOffset = this.isMoving ? Math.sin(this.animationFrame * Math.PI / 2) * 2 : 0;
    
    // Body (different color from local player - red/orange)
    ctx.fillStyle = '#ef4444'; // Red for remote players
    ctx.fillRect(
      screenPos.x + 4,
      screenPos.y + 8 - bobOffset,
      this.size.x - 8,
      this.size.y - 8
    );
    
    // Head
    ctx.fillStyle = '#fcd34d'; // Skin tone
    ctx.beginPath();
    ctx.arc(
      screenPos.x + this.size.x / 2,
      screenPos.y + 8 - bobOffset,
      8,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Eyes based on direction
    ctx.fillStyle = '#1e293b';
    const eyeOffsetX = this.direction.x * 2;
    const eyeOffsetY = this.direction.y * 2;
    
    // Left eye
    ctx.beginPath();
    ctx.arc(
      screenPos.x + this.size.x / 2 - 3 + eyeOffsetX,
      screenPos.y + 7 - bobOffset + eyeOffsetY,
      1.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(
      screenPos.x + this.size.x / 2 + 3 + eyeOffsetX,
      screenPos.y + 7 - bobOffset + eyeOffsetY,
      1.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Draw name above player
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    
    const nameY = screenPos.y - 8;
    ctx.strokeText(this.displayName, screenPos.x + this.size.x / 2, nameY);
    ctx.fillText(this.displayName, screenPos.x + this.size.x / 2, nameY);
    
    // Draw health bar if damaged
    if (this.health < this.maxHealth) {
      const barWidth = 30;
      const barHeight = 3;
      const barX = screenPos.x + (this.size.x - barWidth) / 2;
      const barY = screenPos.y - 15;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // Health
      const healthPercent = this.health / this.maxHealth;
      ctx.fillStyle = healthPercent > 0.3 ? '#22c55e' : '#ef4444';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }
    
    ctx.textAlign = 'left';
  }
  
  /**
   * Get interpolation buffer for debugging
   */
  getInterpolationBuffer(): InterpolationBuffer {
    return this.interpolationBuffer;
  }
  
  /**
   * Get current interpolated state
   */
  getCurrentState(): InterpolatedState | null {
    return this.currentState;
  }
  
  /**
   * Get health
   */
  getHealth(): number {
    return this.health;
  }
  
  /**
   * Get max health
   */
  getMaxHealth(): number {
    return this.maxHealth;
  }
  
  /**
   * Get direction
   */
  getDirection(): Vector2 {
    return { ...this.direction };
  }
  
  /**
   * Clear interpolation history
   */
  clearHistory(): void {
    this.interpolationBuffer.clear();
    this.currentState = null;
  }
}
