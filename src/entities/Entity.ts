import type { Vector2, EntityType, Rectangle } from '../types';
import { Vec2, Rect } from '../utils/math';

/**
 * Base Entity class - all game objects inherit from this
 * Extend this class to create new entity types
 */
export abstract class Entity {
  readonly id: string;
  protected position: Vector2;
  protected size: Vector2;
  protected velocity: Vector2 = { x: 0, y: 0 };
  readonly type: EntityType;
  
  // Flags for entity behavior
  collidable: boolean;
  interactable: boolean;
  visible: boolean = true;
  active: boolean = true;

  constructor(config: {
    id?: string;
    position: Vector2;
    size: Vector2;
    type: EntityType;
    collidable?: boolean;
    interactable?: boolean;
  }) {
    this.id = config.id ?? crypto.randomUUID();
    this.position = Vec2.clone(config.position);
    this.size = Vec2.clone(config.size);
    this.type = config.type;
    this.collidable = config.collidable ?? false;
    this.interactable = config.interactable ?? false;
  }

  /**
   * Update entity state - override in subclasses
   */
  abstract update(deltaTime: number): void;

  /**
   * Render entity - override in subclasses
   */
  abstract render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void;

  /**
   * Called when player interacts with this entity
   */
  onInteract?(): void;

  /**
   * Called when collision occurs with another entity
   */
  onCollision?(other: Entity): void;

  /**
   * Get entity position
   */
  getPosition(): Vector2 {
    return Vec2.clone(this.position);
  }

  /**
   * Set entity position
   */
  setPosition(pos: Vector2): void {
    this.position = Vec2.clone(pos);
  }

  /**
   * Get entity size
   */
  getSize(): Vector2 {
    return Vec2.clone(this.size);
  }

  /**
   * Get entity center position
   */
  getCenter(): Vector2 {
    return {
      x: this.position.x + this.size.x / 2,
      y: this.position.y + this.size.y / 2,
    };
  }

  /**
   * Get entity bounding box
   */
  getBounds(): Rectangle {
    return Rect.create(
      this.position.x,
      this.position.y,
      this.size.x,
      this.size.y
    );
  }

  /**
   * Check if this entity collides with another
   */
  collidesWith(other: Entity): boolean {
    if (!this.collidable || !other.collidable) return false;
    return Rect.intersects(this.getBounds(), other.getBounds());
  }

  /**
   * Get velocity
   */
  getVelocity(): Vector2 {
    return Vec2.clone(this.velocity);
  }

  /**
   * Set velocity
   */
  setVelocity(vel: Vector2): void {
    this.velocity = Vec2.clone(vel);
  }

  /**
   * Move entity by velocity * deltaTime
   */
  protected applyVelocity(deltaTime: number): void {
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
  }

  /**
   * Check if a point is inside this entity
   */
  containsPoint(point: Vector2): boolean {
    return Rect.contains(this.getBounds(), point);
  }

  /**
   * Get distance to another entity (center to center)
   */
  distanceTo(other: Entity): number {
    return Vec2.distance(this.getCenter(), other.getCenter());
  }
}

/**
 * Static entity that doesn't move (trees, rocks, etc.)
 */
export abstract class StaticEntity extends Entity {
  update(_deltaTime: number): void {
    // Static entities don't update
  }
}
