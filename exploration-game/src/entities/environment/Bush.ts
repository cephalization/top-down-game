import { StaticEntity } from '../Entity';
import type { Vector2 } from '../../types';

export type BushVariant = 'green' | 'flowering' | 'berry' | 'dry';

/**
 * Bush entity - decorative environment object, some may have berries to collect
 */
export class Bush extends StaticEntity {
  private variant: BushVariant;
  private hasBerries: boolean;

  constructor(position: Vector2, variant: BushVariant = 'green') {
    super({
      position,
      size: { x: 24, y: 20 },
      type: 'bush',
      collidable: false, // Player can walk through bushes
      interactable: variant === 'berry',
    });
    this.variant = variant;
    this.hasBerries = variant === 'berry';
  }

  render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void {
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(
      screenPos.x + this.size.x / 2,
      screenPos.y + this.size.y,
      this.size.x / 2,
      4,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Base color based on variant
    let baseColor: string;
    switch (this.variant) {
      case 'green':
        baseColor = '#22c55e';
        break;
      case 'flowering':
        baseColor = '#16a34a';
        break;
      case 'berry':
        baseColor = '#15803d';
        break;
      case 'dry':
        baseColor = '#a3a042';
        break;
    }

    // Draw bush (multiple overlapping circles)
    const circles = [
      { x: 0.3, y: 0.5, r: 0.35 },
      { x: 0.7, y: 0.5, r: 0.35 },
      { x: 0.5, y: 0.4, r: 0.4 },
    ];

    ctx.fillStyle = baseColor;
    circles.forEach(c => {
      ctx.beginPath();
      ctx.arc(
        screenPos.x + this.size.x * c.x,
        screenPos.y + this.size.y * c.y,
        this.size.x * c.r,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });

    // Add flowers for flowering variant
    if (this.variant === 'flowering') {
      const flowerPositions = [
        { x: 0.2, y: 0.3 },
        { x: 0.5, y: 0.2 },
        { x: 0.8, y: 0.35 },
        { x: 0.35, y: 0.5 },
        { x: 0.65, y: 0.45 },
      ];
      
      ctx.fillStyle = '#fbbf24';
      flowerPositions.forEach(f => {
        ctx.beginPath();
        ctx.arc(
          screenPos.x + this.size.x * f.x,
          screenPos.y + this.size.y * f.y,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    }

    // Add berries for berry variant
    if (this.variant === 'berry' && this.hasBerries) {
      const berryPositions = [
        { x: 0.25, y: 0.4 },
        { x: 0.45, y: 0.55 },
        { x: 0.7, y: 0.35 },
        { x: 0.55, y: 0.25 },
        { x: 0.3, y: 0.6 },
      ];
      
      ctx.fillStyle = '#dc2626';
      berryPositions.forEach(b => {
        ctx.beginPath();
        ctx.arc(
          screenPos.x + this.size.x * b.x,
          screenPos.y + this.size.y * b.y,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    }
  }

  onInteract(): void {
    if (this.variant === 'berry' && this.hasBerries) {
      this.hasBerries = false;
      console.log('Collected berries!');
      // Return collected item - could emit an event here
    }
  }

  getVariant(): BushVariant {
    return this.variant;
  }

  hasBerriesLeft(): boolean {
    return this.hasBerries;
  }
}
