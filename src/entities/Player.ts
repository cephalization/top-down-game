import { Entity } from './Entity';
import type { Vector2 } from '../types';
import type { PlayerInput } from '../shared/protocol';
import { Vec2 } from '../utils/math';

/**
 * Player entity - controlled by user input
 * Supports both local input and network reconciliation
 */
export class Player extends Entity {
  private baseSpeed: number;
  private sprintMultiplier: number = 1.8;
  private isSprinting: boolean = false;
  private direction: Vector2 = { x: 0, y: 1 }; // Facing direction
  private animationFrame: number = 0;
  private animationTimer: number = 0;
  private isMoving: boolean = false;

  // Player stats (expandable for RPG elements)
  private stats = {
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
  };

  // Inventory (simple implementation for future expansion)
  private inventory: string[] = [];
  
  // Network player ID (set when in multiplayer)
  private networkId: string = '';

  constructor(position: Vector2, speed: number = 200) {
    super({
      position,
      size: { x: 28, y: 28 },
      type: 'player',
      collidable: true,
      interactable: false,
    });
    this.baseSpeed = speed;
  }

  /**
   * Update player state
   */
  update(deltaTime: number): void {
    // Apply velocity
    this.applyVelocity(deltaTime);

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

    // Regenerate stamina when not sprinting
    if (!this.isSprinting && this.stats.stamina < this.stats.maxStamina) {
      this.stats.stamina = Math.min(
        this.stats.maxStamina,
        this.stats.stamina + 20 * deltaTime
      );
    }
  }

  /**
   * Render player
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
    
    // Body
    ctx.fillStyle = '#3b82f6'; // Blue
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
  }

  /**
   * Set movement input
   */
  setMovementInput(input: Vector2, sprinting: boolean): void {
    this.isMoving = input.x !== 0 || input.y !== 0;
    this.isSprinting = sprinting && this.stats.stamina > 0;

    // Update facing direction
    if (this.isMoving) {
      this.direction = Vec2.normalize(input);
    }

    // Calculate speed
    let speed = this.baseSpeed;
    if (this.isSprinting) {
      speed *= this.sprintMultiplier;
      this.stats.stamina = Math.max(0, this.stats.stamina - 30 * (1 / 60));
    }

    // Set velocity
    this.velocity = Vec2.multiply(input, speed);
  }

  /**
   * Get current speed (accounting for sprint)
   */
  getCurrentSpeed(): number {
    return this.isSprinting ? this.baseSpeed * this.sprintMultiplier : this.baseSpeed;
  }

  /**
   * Get player stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): void {
    this.stats.health = Math.max(0, this.stats.health - amount);
  }

  /**
   * Heal
   */
  heal(amount: number): void {
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
  }

  /**
   * Check if player is alive
   */
  isAlive(): boolean {
    return this.stats.health > 0;
  }

  /**
   * Add item to inventory
   */
  addToInventory(item: string): void {
    this.inventory.push(item);
  }

  /**
   * Get inventory
   */
  getInventory(): string[] {
    return [...this.inventory];
  }

  /**
   * Get facing direction
   */
  getDirection(): Vector2 {
    return Vec2.clone(this.direction);
  }

  /**
   * Apply a network input (for client-side prediction and reconciliation)
   * Returns the new position after applying the input
   */
  applyInput(input: PlayerInput, deltaTime: number): { x: number; y: number } {
    // Set movement input
    this.setMovementInput({ x: input.dx, y: input.dy }, input.sprint);
    
    // Apply velocity manually (similar to update but without animation)
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    
    return {
      x: this.position.x,
      y: this.position.y,
    };
  }

  /**
   * Snap to a specific position (used for server reconciliation)
   */
  snapToPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Set player stats from server state
   */
  setStats(health: number, maxHealth: number, stamina: number, maxStamina: number): void {
    this.stats.health = health;
    this.stats.maxHealth = maxHealth;
    this.stats.stamina = stamina;
    this.stats.maxStamina = maxStamina;
  }

  /**
   * Set network player ID
   */
  setNetworkId(id: string): void {
    this.networkId = id;
  }

  /**
   * Get network player ID
   */
  getNetworkId(): string {
    return this.networkId;
  }

  /**
   * Get base speed
   */
  getBaseSpeed(): number {
    return this.baseSpeed;
  }

  /**
   * Get sprint multiplier
   */
  getSprintMultiplier(): number {
    return this.sprintMultiplier;
  }
}
