import { StaticEntity } from '../Entity';
import type { Vector2 } from '../../types';

export type FlowerVariant = 'red' | 'yellow' | 'blue' | 'white' | 'purple';

/**
 * Flower entity - small decorative element
 */
export class Flower extends StaticEntity {
  private variant: FlowerVariant;
  private petalCount: number;

  constructor(position: Vector2, variant: FlowerVariant = 'yellow') {
    super({
      position,
      size: { x: 12, y: 12 },
      type: 'flower',
      collidable: false,
      interactable: true,
    });
    this.variant = variant;
    this.petalCount = 5 + Math.floor(Math.random() * 3);
  }

  render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void {
    const centerX = screenPos.x + this.size.x / 2;
    const centerY = screenPos.y + this.size.y / 2;

    // Stem
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 3);
    ctx.lineTo(centerX, screenPos.y + this.size.y);
    ctx.stroke();

    // Petal color based on variant
    const colors: Record<FlowerVariant, string> = {
      red: '#ef4444',
      yellow: '#fbbf24',
      blue: '#3b82f6',
      white: '#f8fafc',
      purple: '#a855f7',
    };

    // Petals
    ctx.fillStyle = colors[this.variant];
    for (let i = 0; i < this.petalCount; i++) {
      const angle = (i / this.petalCount) * Math.PI * 2;
      const petalX = centerX + Math.cos(angle) * 4;
      const petalY = centerY + Math.sin(angle) * 4;
      
      ctx.beginPath();
      ctx.ellipse(petalX, petalY, 3, 2, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  onInteract(): void {
    console.log(`Picked a ${this.variant} flower!`);
  }

  getVariant(): FlowerVariant {
    return this.variant;
  }
}
