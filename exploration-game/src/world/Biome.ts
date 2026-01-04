import type { TileType, BiomeType, EntityConfig } from '../types';
import { SeededRandom } from '../utils/math';
import type { TreeVariant } from '../entities/environment/Tree';
import type { RockVariant } from '../entities/environment/Rock';
import type { BushVariant } from '../entities/environment/Bush';
import type { FlowerVariant } from '../entities/environment/Flower';

/**
 * Biome configuration - defines what spawns in each biome
 */
export interface BiomeConfig {
  type: BiomeType;
  primaryTile: TileType;
  secondaryTile: TileType;
  treeVariants: TreeVariant[];
  treeDensity: number;
  rockDensity: number;
  bushDensity: number;
  flowerDensity: number;
  flowerVariants: FlowerVariant[];
  bushVariants: BushVariant[];
  rockVariants: RockVariant[];
}

/**
 * Biome definitions
 */
export const BIOMES: Record<BiomeType, BiomeConfig> = {
  plains: {
    type: 'plains',
    primaryTile: 'grass',
    secondaryTile: 'dirt',
    treeVariants: ['oak'],
    treeDensity: 0.02,
    rockDensity: 0.01,
    bushDensity: 0.03,
    flowerDensity: 0.05,
    flowerVariants: ['yellow', 'white', 'red'],
    bushVariants: ['green', 'flowering'],
    rockVariants: ['small', 'medium'],
  },
  forest: {
    type: 'forest',
    primaryTile: 'grass',
    secondaryTile: 'dirt',
    treeVariants: ['oak', 'pine'],
    treeDensity: 0.15,
    rockDensity: 0.02,
    bushDensity: 0.08,
    flowerDensity: 0.02,
    flowerVariants: ['white', 'purple'],
    bushVariants: ['green', 'berry'],
    rockVariants: ['small', 'medium', 'large'],
  },
  desert: {
    type: 'desert',
    primaryTile: 'sand',
    secondaryTile: 'dirt',
    treeVariants: ['palm', 'dead'],
    treeDensity: 0.01,
    rockDensity: 0.03,
    bushDensity: 0.01,
    flowerDensity: 0,
    flowerVariants: [],
    bushVariants: ['dry'],
    rockVariants: ['medium', 'large', 'boulder'],
  },
  mountains: {
    type: 'mountains',
    primaryTile: 'stone',
    secondaryTile: 'dirt',
    treeVariants: ['pine'],
    treeDensity: 0.05,
    rockDensity: 0.12,
    bushDensity: 0.02,
    flowerDensity: 0.01,
    flowerVariants: ['white', 'blue'],
    bushVariants: ['green'],
    rockVariants: ['large', 'boulder'],
  },
  tundra: {
    type: 'tundra',
    primaryTile: 'snow',
    secondaryTile: 'stone',
    treeVariants: ['pine', 'dead'],
    treeDensity: 0.03,
    rockDensity: 0.04,
    bushDensity: 0.01,
    flowerDensity: 0,
    flowerVariants: [],
    bushVariants: ['dry'],
    rockVariants: ['medium', 'large'],
  },
};

/**
 * Determine biome based on noise values
 */
export function getBiomeFromNoise(
  elevation: number,
  moisture: number,
  temperature: number
): BiomeType {
  // High elevation = mountains
  if (elevation > 0.6) {
    if (temperature < 0.3) return 'tundra';
    return 'mountains';
  }

  // Low temperature = tundra
  if (temperature < 0.25) {
    return 'tundra';
  }

  // High temperature + low moisture = desert
  if (temperature > 0.7 && moisture < 0.4) {
    return 'desert';
  }

  // High moisture = forest
  if (moisture > 0.5) {
    return 'forest';
  }

  // Default = plains
  return 'plains';
}

/**
 * Generate entities for a tile position based on biome
 */
export function generateEntitiesForPosition(
  worldX: number,
  worldY: number,
  biome: BiomeConfig,
  random: SeededRandom,
  tileSize: number
): EntityConfig[] {
  const entities: EntityConfig[] = [];

  // Try to spawn a tree
  if (biome.treeDensity > 0 && random.chance(biome.treeDensity)) {
    // Variant selection available for future sprite implementation
    random.pick(biome.treeVariants);
    entities.push({
      id: `tree-${worldX}-${worldY}`,
      position: {
        x: worldX * tileSize + random.nextFloat(0, tileSize * 0.5),
        y: worldY * tileSize + random.nextFloat(0, tileSize * 0.5),
      },
      size: { x: 32, y: 48 },
      type: 'tree',
      collidable: true,
      interactable: true,
    });
    // Don't spawn other things on tree tiles
    return entities;
  }

  // Try to spawn a rock
  if (biome.rockDensity > 0 && random.chance(biome.rockDensity)) {
    const variant = random.pick(biome.rockVariants);
    const sizes: Record<RockVariant, { x: number; y: number }> = {
      small: { x: 16, y: 12 },
      medium: { x: 24, y: 18 },
      large: { x: 32, y: 24 },
      boulder: { x: 48, y: 36 },
    };
    entities.push({
      id: `rock-${worldX}-${worldY}`,
      position: {
        x: worldX * tileSize + random.nextFloat(0, tileSize * 0.6),
        y: worldY * tileSize + random.nextFloat(0, tileSize * 0.6),
      },
      size: sizes[variant],
      type: 'rock',
      collidable: true,
    });
    return entities;
  }

  // Try to spawn a bush
  if (biome.bushDensity > 0 && random.chance(biome.bushDensity)) {
    entities.push({
      id: `bush-${worldX}-${worldY}`,
      position: {
        x: worldX * tileSize + random.nextFloat(0, tileSize * 0.7),
        y: worldY * tileSize + random.nextFloat(0, tileSize * 0.7),
      },
      size: { x: 24, y: 20 },
      type: 'bush',
      collidable: false,
    });
  }

  // Try to spawn flowers
  if (biome.flowerDensity > 0 && random.chance(biome.flowerDensity)) {
    entities.push({
      id: `flower-${worldX}-${worldY}`,
      position: {
        x: worldX * tileSize + random.nextFloat(0, tileSize * 0.8),
        y: worldY * tileSize + random.nextFloat(0, tileSize * 0.8),
      },
      size: { x: 12, y: 12 },
      type: 'flower',
      collidable: false,
    });
  }

  return entities;
}
