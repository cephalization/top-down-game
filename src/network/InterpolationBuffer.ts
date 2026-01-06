/**
 * InterpolationBuffer - Smooth rendering for remote players
 * Buffers position history and interpolates between states
 */

import type { PlayerState } from '../shared/protocol';
import { INTERPOLATION_DELAY } from '../shared/protocol';

export interface BufferedState {
  timestamp: number;
  state: PlayerState;
}

export interface InterpolatedState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: { x: number; y: number };
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
}

export class InterpolationBuffer {
  private history: BufferedState[] = [];
  private maxHistoryLength: number;
  private interpolationDelay: number;
  
  // For tracking time sync
  private serverTimeOffset: number = 0;
  
  constructor(maxHistoryMs: number = 1000, interpolationDelay: number = INTERPOLATION_DELAY) {
    // Calculate max history entries based on expected tick rate (20 Hz = 50ms)
    this.maxHistoryLength = Math.ceil(maxHistoryMs / 50);
    this.interpolationDelay = interpolationDelay;
  }
  
  /**
   * Add a new state to the buffer
   */
  addState(state: PlayerState, serverTime: number): void {
    this.history.push({
      timestamp: serverTime,
      state,
    });
    
    // Remove old history
    while (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
    
    // Update server time offset estimate
    const localTime = performance.now();
    this.serverTimeOffset = serverTime - localTime;
  }
  
  /**
   * Get interpolated state at the render time
   * Render time = current time - interpolation delay
   */
  getInterpolatedState(): InterpolatedState | null {
    if (this.history.length === 0) {
      return null;
    }
    
    // Calculate render time
    const localTime = performance.now();
    const estimatedServerTime = localTime + this.serverTimeOffset;
    const renderTime = estimatedServerTime - this.interpolationDelay;
    
    // If we only have one state, just return it
    if (this.history.length === 1) {
      return this.stateToInterpolated(this.history[0].state);
    }
    
    // Find two states that bracket renderTime
    let before: BufferedState | null = null;
    let after: BufferedState | null = null;
    
    for (let i = 0; i < this.history.length - 1; i++) {
      if (this.history[i].timestamp <= renderTime && this.history[i + 1].timestamp >= renderTime) {
        before = this.history[i];
        after = this.history[i + 1];
        break;
      }
    }
    
    // If renderTime is before all history, use oldest state
    if (renderTime < this.history[0].timestamp) {
      return this.stateToInterpolated(this.history[0].state);
    }
    
    // If renderTime is after all history, extrapolate from latest state
    if (!before || !after) {
      const latest = this.history[this.history.length - 1];
      const prev = this.history.length > 1 ? this.history[this.history.length - 2] : null;
      
      if (prev) {
        // Extrapolate based on velocity
        const dt = (renderTime - latest.timestamp) / 1000;
        const maxExtrapolation = 0.2; // Max 200ms extrapolation
        const clampedDt = Math.min(dt, maxExtrapolation);
        
        return {
          x: latest.state.x + latest.state.vx * clampedDt,
          y: latest.state.y + latest.state.vy * clampedDt,
          vx: latest.state.vx,
          vy: latest.state.vy,
          direction: { ...latest.state.direction },
          health: latest.state.health,
          maxHealth: latest.state.maxHealth,
          stamina: latest.state.stamina,
          maxStamina: latest.state.maxStamina,
        };
      }
      
      return this.stateToInterpolated(latest.state);
    }
    
    // Interpolate between before and after
    const t = (renderTime - before.timestamp) / (after.timestamp - before.timestamp);
    
    return {
      x: this.lerp(before.state.x, after.state.x, t),
      y: this.lerp(before.state.y, after.state.y, t),
      vx: this.lerp(before.state.vx, after.state.vx, t),
      vy: this.lerp(before.state.vy, after.state.vy, t),
      direction: {
        x: this.lerp(before.state.direction.x, after.state.direction.x, t),
        y: this.lerp(before.state.direction.y, after.state.direction.y, t),
      },
      health: after.state.health, // Don't interpolate health
      maxHealth: after.state.maxHealth,
      stamina: after.state.stamina, // Don't interpolate stamina
      maxStamina: after.state.maxStamina,
    };
  }
  
  /**
   * Get the latest raw state (without interpolation)
   */
  getLatestState(): PlayerState | null {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1].state;
  }
  
  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }
  
  /**
   * Convert PlayerState to InterpolatedState
   */
  private stateToInterpolated(state: PlayerState): InterpolatedState {
    return {
      x: state.x,
      y: state.y,
      vx: state.vx,
      vy: state.vy,
      direction: { ...state.direction },
      health: state.health,
      maxHealth: state.maxHealth,
      stamina: state.stamina,
      maxStamina: state.maxStamina,
    };
  }
  
  /**
   * Clear the buffer
   */
  clear(): void {
    this.history = [];
  }
  
  /**
   * Get buffer statistics
   */
  getStats(): {
    historyLength: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    serverTimeOffset: number;
  } {
    return {
      historyLength: this.history.length,
      oldestTimestamp: this.history.length > 0 ? this.history[0].timestamp : null,
      newestTimestamp: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
      serverTimeOffset: this.serverTimeOffset,
    };
  }
  
  /**
   * Set interpolation delay
   */
  setInterpolationDelay(delay: number): void {
    this.interpolationDelay = delay;
  }
  
  /**
   * Get current interpolation delay
   */
  getInterpolationDelay(): number {
    return this.interpolationDelay;
  }
}
