import { StaticEntity } from '../Entity';
import type { Vector2 } from '../../types';

export type TreeVariant = 'oak' | 'pine' | 'palm' | 'dead';

/**
 * Tree entity - decorative environment object
 */
export class Tree extends StaticEntity {
  private variant: TreeVariant;
  private scale: number;

  constructor(position: Vector2, variant: TreeVariant = 'oak', scale: number = 1) {
    super({
      position,
      size: { x: 32 * scale, y: 48 * scale },
      type: 'tree',
      collidable: true,
      interactable: true,
    });
    this.variant = variant;
    this.scale = scale;
  }

  render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void {
    const s = this.scale;
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(
      screenPos.x + this.size.x / 2,
      screenPos.y + this.size.y,
      this.size.x / 2,
      8 * s,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    switch (this.variant) {
      case 'oak':
        this.renderOak(ctx, screenPos, s);
        break;
      case 'pine':
        this.renderPine(ctx, screenPos, s);
        break;
      case 'palm':
        this.renderPalm(ctx, screenPos, s);
        break;
      case 'dead':
        this.renderDead(ctx, screenPos, s);
        break;
    }
  }

  private renderOak(ctx: CanvasRenderingContext2D, pos: Vector2, s: number): void {
    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(pos.x + 12 * s, pos.y + 30 * s, 8 * s, 18 * s);
    
    // Foliage (layered circles)
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(pos.x + 16 * s, pos.y + 20 * s, 14 * s, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(pos.x + 10 * s, pos.y + 24 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(pos.x + 22 * s, pos.y + 24 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPine(ctx: CanvasRenderingContext2D, pos: Vector2, s: number): void {
    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(pos.x + 13 * s, pos.y + 35 * s, 6 * s, 13 * s);
    
    // Foliage (triangles)
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(pos.x + 16 * s, pos.y + 5 * s);
    ctx.lineTo(pos.x + 4 * s, pos.y + 25 * s);
    ctx.lineTo(pos.x + 28 * s, pos.y + 25 * s);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(pos.x + 16 * s, pos.y + 15 * s);
    ctx.lineTo(pos.x + 2 * s, pos.y + 38 * s);
    ctx.lineTo(pos.x + 30 * s, pos.y + 38 * s);
    ctx.fill();
  }

  private renderPalm(ctx: CanvasRenderingContext2D, pos: Vector2, s: number): void {
    // Curved trunk
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x + 16 * s, pos.y + 48 * s);
    ctx.quadraticCurveTo(pos.x + 20 * s, pos.y + 30 * s, pos.x + 16 * s, pos.y + 15 * s);
    ctx.stroke();
    
    // Palm fronds
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3 * s;
    const frondAngles = [-140, -100, -60, -40, 40, 60, 100, 140];
    frondAngles.forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(pos.x + 16 * s, pos.y + 15 * s);
      ctx.quadraticCurveTo(
        pos.x + 16 * s + Math.cos(rad) * 12 * s,
        pos.y + 15 * s + Math.sin(rad) * 8 * s,
        pos.x + 16 * s + Math.cos(rad) * 20 * s,
        pos.y + 15 * s + Math.sin(rad) * 15 * s
      );
      ctx.stroke();
    });
  }

  private renderDead(ctx: CanvasRenderingContext2D, pos: Vector2, s: number): void {
    // Bare trunk
    ctx.strokeStyle = '#57534e';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    
    // Main trunk
    ctx.beginPath();
    ctx.moveTo(pos.x + 16 * s, pos.y + 48 * s);
    ctx.lineTo(pos.x + 16 * s, pos.y + 15 * s);
    ctx.stroke();
    
    // Branches
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(pos.x + 16 * s, pos.y + 25 * s);
    ctx.lineTo(pos.x + 6 * s, pos.y + 15 * s);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(pos.x + 16 * s, pos.y + 20 * s);
    ctx.lineTo(pos.x + 26 * s, pos.y + 10 * s);
    ctx.stroke();
  }

  getVariant(): TreeVariant {
    return this.variant;
  }

  onInteract(): void {
    console.log(`Interacted with ${this.variant} tree`);
  }
}
