import { StaticEntity } from '../Entity';
import type { Vector2 } from '../../types';

export type RockVariant = 'small' | 'medium' | 'large' | 'boulder';

/**
 * Rock entity - decorative/obstacle environment object
 */
export class Rock extends StaticEntity {
  private variant: RockVariant;
  private color: string;

  constructor(position: Vector2, variant: RockVariant = 'medium') {
    const sizes: Record<RockVariant, Vector2> = {
      small: { x: 16, y: 12 },
      medium: { x: 24, y: 18 },
      large: { x: 32, y: 24 },
      boulder: { x: 48, y: 36 },
    };

    super({
      position,
      size: sizes[variant],
      type: 'rock',
      collidable: true,
      interactable: false,
    });
    
    this.variant = variant;
    // Slightly randomize color for variety
    const shade = 80 + Math.floor(Math.random() * 40);
    this.color = `rgb(${shade}, ${shade - 5}, ${shade - 10})`;
  }

  render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void {
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(
      screenPos.x + this.size.x / 2,
      screenPos.y + this.size.y,
      this.size.x / 2,
      this.size.y / 4,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw rock
    ctx.fillStyle = this.color;
    ctx.beginPath();
    
    if (this.variant === 'boulder') {
      // Boulder is more jagged
      ctx.moveTo(screenPos.x + this.size.x * 0.2, screenPos.y + this.size.y);
      ctx.lineTo(screenPos.x, screenPos.y + this.size.y * 0.6);
      ctx.lineTo(screenPos.x + this.size.x * 0.15, screenPos.y + this.size.y * 0.2);
      ctx.lineTo(screenPos.x + this.size.x * 0.5, screenPos.y);
      ctx.lineTo(screenPos.x + this.size.x * 0.85, screenPos.y + this.size.y * 0.15);
      ctx.lineTo(screenPos.x + this.size.x, screenPos.y + this.size.y * 0.5);
      ctx.lineTo(screenPos.x + this.size.x * 0.8, screenPos.y + this.size.y);
      ctx.closePath();
    } else {
      // Rounded rock shape
      ctx.ellipse(
        screenPos.x + this.size.x / 2,
        screenPos.y + this.size.y / 2,
        this.size.x / 2,
        this.size.y / 2,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(
      screenPos.x + this.size.x * 0.35,
      screenPos.y + this.size.y * 0.35,
      this.size.x * 0.2,
      this.size.y * 0.15,
      -0.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  getVariant(): RockVariant {
    return this.variant;
  }
}
