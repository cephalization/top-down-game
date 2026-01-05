/**
 * Server-side player state
 * Maintains authoritative position and handles input processing
 */

import type { PlayerInput, PlayerState } from '../shared/protocol';

export class ServerPlayer {
  readonly id: string;
  displayName: string;
  
  // Position and velocity
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  
  // Direction facing
  direction: { x: number; y: number } = { x: 0, y: 1 };
  
  // Stats
  health: number = 100;
  maxHealth: number = 100;
  stamina: number = 100;
  maxStamina: number = 100;
  
  // Movement
  private baseSpeed: number = 200;
  private sprintMultiplier: number = 1.8;
  
  // Input tracking
  lastProcessedSeq: number = 0;
  private pendingInputs: Array<{ seq: number; input: PlayerInput }> = [];
  
  constructor(id: string, displayName: string) {
    this.id = id;
    this.displayName = displayName;
  }
  
  /**
   * Queue an input for processing
   */
  queueInput(seq: number, input: PlayerInput): void {
    // Only accept inputs newer than last processed
    if (seq <= this.lastProcessedSeq) return;
    
    // Insert in order by seq
    const insertIndex = this.pendingInputs.findIndex(i => i.seq > seq);
    if (insertIndex === -1) {
      this.pendingInputs.push({ seq, input });
    } else {
      this.pendingInputs.splice(insertIndex, 0, { seq, input });
    }
    
    // Limit queue size to prevent memory issues
    while (this.pendingInputs.length > 60) {
      this.pendingInputs.shift();
    }
  }
  
  /**
   * Process all pending inputs up to a certain count
   * Returns the number of inputs processed
   */
  processInputs(deltaTime: number, maxInputs: number = 10): number {
    let processed = 0;
    
    while (this.pendingInputs.length > 0 && processed < maxInputs) {
      const { seq, input } = this.pendingInputs.shift()!;
      this.applyInput(input, deltaTime);
      this.lastProcessedSeq = seq;
      processed++;
    }
    
    return processed;
  }
  
  /**
   * Apply a single input to update player state
   */
  applyInput(input: PlayerInput, deltaTime: number): void {
    const isMoving = input.dx !== 0 || input.dy !== 0;
    const isSprinting = input.sprint && this.stamina > 0;
    
    // Update direction if moving
    if (isMoving) {
      const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
      if (len > 0) {
        this.direction.x = input.dx / len;
        this.direction.y = input.dy / len;
      }
    }
    
    // Calculate speed
    let speed = this.baseSpeed;
    if (isSprinting) {
      speed *= this.sprintMultiplier;
      this.stamina = Math.max(0, this.stamina - 30 * deltaTime);
    } else if (!isMoving && this.stamina < this.maxStamina) {
      // Regenerate stamina when not sprinting
      this.stamina = Math.min(this.maxStamina, this.stamina + 20 * deltaTime);
    }
    
    // Calculate velocity
    if (isMoving) {
      const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
      this.vx = (input.dx / len) * speed;
      this.vy = (input.dy / len) * speed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
    
    // Apply velocity
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }
  
  /**
   * Update player state (called each tick even without inputs)
   */
  update(deltaTime: number): void {
    // Regenerate stamina if not moving
    if (this.vx === 0 && this.vy === 0 && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 20 * deltaTime);
    }
  }
  
  /**
   * Take damage
   */
  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }
  
  /**
   * Heal
   */
  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }
  
  /**
   * Check if alive
   */
  isAlive(): boolean {
    return this.health > 0;
  }
  
  /**
   * Get serializable state for network transmission
   */
  getState(): PlayerState {
    return {
      id: this.id,
      displayName: this.displayName,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      direction: { ...this.direction },
    };
  }
  
  /**
   * Set position (used for spawn points, teleportation, etc.)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  
  /**
   * Reset player to initial state
   */
  reset(): void {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.vx = 0;
    this.vy = 0;
    this.direction = { x: 0, y: 1 };
    this.lastProcessedSeq = 0;
    this.pendingInputs = [];
  }
}
