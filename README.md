# Exploration Game

A simple top-down 2D exploration game with procedurally generated infinite maps, built with React, TypeScript, and Bun.

## Features

- **Infinite Procedural World**: Chunks are generated on-the-fly using Simplex noise
- **Multiple Biomes**: Plains, Forest, Desert, Mountains, and Tundra
- **Dynamic Entity Spawning**: Trees, rocks, bushes, and flowers based on biome
- **Smooth Camera**: Camera follows player with smooth interpolation
- **Player Stats**: Health and stamina system (expandable for RPG elements)
- **Modular Architecture**: Easy to extend with new entities, mechanics, and features

## Controls

| Key | Action |
|-----|--------|
| W / ↑ | Move up |
| S / ↓ | Move down |
| A / ← | Move left |
| D / → | Move right |
| Shift | Sprint (uses stamina) |
| ESC | Pause game |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0 or later)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Project Structure

```
src/
├── components/          # React UI components
│   ├── GameCanvas.tsx   # Main game canvas wrapper
│   ├── HUD.tsx          # Heads-up display (health, stamina)
│   ├── Controls.tsx     # Controls overlay
│   └── SeedInput.tsx    # World seed input
├── entities/            # Game entities
│   ├── Entity.ts        # Base entity class
│   ├── Player.ts        # Player entity
│   └── environment/     # Environment entities
│       ├── Tree.ts
│       ├── Rock.ts
│       ├── Bush.ts
│       └── Flower.ts
├── game/                # Core game systems
│   ├── Game.ts          # Main game orchestrator
│   ├── Camera.ts        # Camera/viewport system
│   └── InputManager.ts  # Input handling
├── rendering/           # Rendering systems
│   └── Renderer.ts      # Canvas rendering
├── world/               # World generation
│   ├── World.ts         # World manager
│   ├── Chunk.ts         # Chunk generation
│   └── Biome.ts         # Biome definitions
├── types/               # TypeScript type definitions
│   └── index.ts
└── utils/               # Utility functions
    └── math.ts          # Vector math, noise, random
```

## Extending the Game

### Adding New Entities

1. Create a new entity class extending `Entity` or `StaticEntity`:

```typescript
// src/entities/environment/Crystal.ts
import { StaticEntity } from '../Entity';
import type { Vector2 } from '../../types';

export class Crystal extends StaticEntity {
  constructor(position: Vector2) {
    super({
      position,
      size: { x: 20, y: 30 },
      type: 'custom',
      collidable: true,
      interactable: true,
    });
  }

  render(ctx: CanvasRenderingContext2D, screenPos: Vector2): void {
    // Draw your crystal here
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(screenPos.x + 10, screenPos.y);
    ctx.lineTo(screenPos.x + 20, screenPos.y + 30);
    ctx.lineTo(screenPos.x, screenPos.y + 30);
    ctx.closePath();
    ctx.fill();
  }

  onInteract(): void {
    console.log('Crystal collected!');
  }
}
```

2. Add entity spawning logic in `src/world/Biome.ts`
3. Update `src/world/World.ts` to instantiate your new entity

### Adding New Biomes

1. Add your biome type to `src/types/index.ts`:

```typescript
export type BiomeType = 'plains' | 'forest' | ... | 'your_biome';
```

2. Create biome configuration in `src/world/Biome.ts`:

```typescript
your_biome: {
  type: 'your_biome',
  primaryTile: 'grass',
  secondaryTile: 'dirt',
  treeVariants: ['oak'],
  treeDensity: 0.05,
  // ...other properties
}
```

3. Update `getBiomeFromNoise()` to include your biome's generation conditions

### Adding New Mechanics

The game is structured to make adding mechanics straightforward:

- **Combat**: Extend the `Player` class with attack methods, add enemy entities
- **Inventory**: Player already has a basic inventory array - extend with item system
- **Quests**: Create a quest manager in `src/game/`
- **NPCs**: Create NPC entities with dialogue systems
- **Crafting**: Add crafting recipes and UI

## Configuration

Game settings can be adjusted in `src/types/index.ts`:

```typescript
export const DEFAULT_CONFIG: GameConfig = {
  tileSize: 32,       // Size of each tile in pixels
  chunkSize: 16,      // Tiles per chunk (16x16)
  viewDistance: 2,    // Chunks loaded around player
  playerSpeed: 200,   // Base player movement speed
  seed: Date.now(),   // World generation seed
};
```

## Technologies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Bun** - Package manager and runtime
- **Canvas 2D** - Rendering

## License

MIT
