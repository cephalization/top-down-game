import type { Vector2, Rectangle } from '../types';

/**
 * Vector math utilities
 */
export const Vec2 = {
  create(x = 0, y = 0): Vector2 {
    return { x, y };
  },

  add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y };
  },

  subtract(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y };
  },

  multiply(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar };
  },

  divide(v: Vector2, scalar: number): Vector2 {
    return { x: v.x / scalar, y: v.y / scalar };
  },

  length(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },

  normalize(v: Vector2): Vector2 {
    const len = Vec2.length(v);
    if (len === 0) return { x: 0, y: 0 };
    return Vec2.divide(v, len);
  },

  distance(a: Vector2, b: Vector2): number {
    return Vec2.length(Vec2.subtract(a, b));
  },

  equals(a: Vector2, b: Vector2): boolean {
    return a.x === b.x && a.y === b.y;
  },

  clone(v: Vector2): Vector2 {
    return { x: v.x, y: v.y };
  },

  floor(v: Vector2): Vector2 {
    return { x: Math.floor(v.x), y: Math.floor(v.y) };
  },
};

/**
 * Rectangle utilities
 */
export const Rect = {
  create(x: number, y: number, width: number, height: number): Rectangle {
    return { x, y, width, height };
  },

  fromPoints(topLeft: Vector2, bottomRight: Vector2): Rectangle {
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  },

  contains(rect: Rectangle, point: Vector2): boolean {
    return (
      point.x >= rect.x &&
      point.x < rect.x + rect.width &&
      point.y >= rect.y &&
      point.y < rect.y + rect.height
    );
  },

  intersects(a: Rectangle, b: Rectangle): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  },

  center(rect: Rectangle): Vector2 {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  },
};

/**
 * Simple seeded random number generator (Mulberry32)
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Returns a random number between 0 and 1
   */
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Returns a random float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Returns true with the given probability (0-1)
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Picks a random element from an array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }

  /**
   * Create a new seeded random with a derived seed
   */
  derive(additionalSeed: number): SeededRandom {
    return new SeededRandom(this.seed + additionalSeed);
  }
}

/**
 * Simplex noise implementation for terrain generation
 */
export class SimplexNoise {
  private perm: number[];
  private gradP: { x: number; y: number }[];

  constructor(seed: number) {
    const random = new SeededRandom(seed);
    
    // Initialize permutation table
    this.perm = [];
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
    }
    
    // Shuffle using seeded random
    for (let i = 255; i > 0; i--) {
      const j = random.nextInt(0, i + 1);
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
    
    // Duplicate for wrapping
    for (let i = 0; i < 256; i++) {
      this.perm[i + 256] = this.perm[i];
    }

    // Gradients for 2D
    const grad2 = [
      { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    ];
    
    this.gradP = [];
    for (let i = 0; i < 512; i++) {
      this.gradP[i] = grad2[this.perm[i] % 8];
    }
  }

  private dot(g: { x: number; y: number }, x: number, y: number): number {
    return g.x * x + g.y * y;
  }

  /**
   * 2D Simplex noise
   * Returns value between -1 and 1
   */
  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    // Skew the input space
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine which simplex we're in
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    // Hashed gradient indices
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.gradP[ii + this.perm[jj]];
    const gi1 = this.gradP[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.gradP[ii + 1 + this.perm[jj + 1]];

    // Calculate contributions
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(gi2, x2, y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  }

  /**
   * Fractal Brownian Motion - layered noise for more natural terrain
   */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, persistence = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Get chunk coordinates from world position
 */
export function worldToChunk(worldPos: Vector2, chunkSize: number, tileSize: number): Vector2 {
  const chunkWorldSize = chunkSize * tileSize;
  return {
    x: Math.floor(worldPos.x / chunkWorldSize),
    y: Math.floor(worldPos.y / chunkWorldSize),
  };
}

/**
 * Get chunk key string
 */
export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

/**
 * Parse chunk key string
 */
export function parseChunkKey(key: string): Vector2 {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}
