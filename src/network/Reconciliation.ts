/**
 * Reconciliation - Server reconciliation logic
 * Handles snapping to server state and replaying unacknowledged inputs
 */

import type { PlayerState, PlayerInput } from '../shared/protocol';
import type { InputBuffer } from './InputBuffer';

export interface ReconciliationResult {
  // Final position after reconciliation
  x: number;
  y: number;
  // How many inputs were replayed
  replayedInputs: number;
  // Position correction magnitude
  correction: number;
  // Whether correction was applied
  correctionApplied: boolean;
}

export interface ReconciliationConfig {
  // Threshold for position correction (if diff is less than this, skip correction)
  correctionThreshold: number;
  // Maximum correction per frame (for smooth corrections)
  maxCorrectionPerFrame: number;
  // Whether to use smooth corrections or immediate snapping
  smoothCorrection: boolean;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  correctionThreshold: 0.5,      // Less than 0.5 pixels - don't correct
  maxCorrectionPerFrame: 50,     // Max 50 pixels per frame for smooth correction
  smoothCorrection: false,       // Use immediate snapping for now
};

export class Reconciliation {
  private config: ReconciliationConfig;
  
  constructor(config: Partial<ReconciliationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Reconcile local player state with server state
   * 
   * @param serverState - Authoritative player state from server
   * @param lastProcessedSeq - Last input sequence processed by server
   * @param inputBuffer - Buffer of pending inputs
   * @param currentX - Current local X position
   * @param currentY - Current local Y position
   * @param applyInput - Function to apply an input and return new position
   */
  reconcile(
    serverState: PlayerState,
    lastProcessedSeq: number,
    inputBuffer: InputBuffer,
    currentX: number,
    currentY: number,
    applyInput: (input: PlayerInput, x: number, y: number) => { x: number; y: number }
  ): ReconciliationResult {
    // Acknowledge processed inputs
    inputBuffer.acknowledge(lastProcessedSeq);
    
    // Get remaining unacknowledged inputs
    const pendingInputs = inputBuffer.getPending();
    
    // Start from server position
    let x = serverState.x;
    let y = serverState.y;
    
    // Replay all unacknowledged inputs
    for (const pending of pendingInputs) {
      const result = applyInput(pending.input, x, y);
      x = result.x;
      y = result.y;
    }
    
    // Calculate correction magnitude
    const dx = x - currentX;
    const dy = y - currentY;
    const correction = Math.sqrt(dx * dx + dy * dy);
    
    // Check if correction is needed
    const correctionApplied = correction > this.config.correctionThreshold;
    
    if (!correctionApplied) {
      // Difference is negligible, keep current position
      return {
        x: currentX,
        y: currentY,
        replayedInputs: pendingInputs.length,
        correction: 0,
        correctionApplied: false,
      };
    }
    
    // Apply correction
    let finalX = x;
    let finalY = y;
    
    if (this.config.smoothCorrection && correction > this.config.maxCorrectionPerFrame) {
      // Smooth correction - interpolate towards correct position
      const ratio = this.config.maxCorrectionPerFrame / correction;
      finalX = currentX + dx * ratio;
      finalY = currentY + dy * ratio;
    }
    
    return {
      x: finalX,
      y: finalY,
      replayedInputs: pendingInputs.length,
      correction,
      correctionApplied: true,
    };
  }
  
  /**
   * Simple reconciliation without input replay
   * Use when client-side prediction is disabled
   */
  snapToServer(serverState: PlayerState): { x: number; y: number } {
    return {
      x: serverState.x,
      y: serverState.y,
    };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<ReconciliationConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): ReconciliationConfig {
    return { ...this.config };
  }
}

/**
 * Utility function to apply player input and return new position
 * This simulates the same physics as the server
 */
export function createInputApplicator(
  baseSpeed: number = 200,
  sprintMultiplier: number = 1.8,
  deltaTime: number = 1 / 20 // 20 Hz tick rate
): (input: PlayerInput, x: number, y: number) => { x: number; y: number } {
  return (input: PlayerInput, x: number, y: number) => {
    const isMoving = input.dx !== 0 || input.dy !== 0;
    
    if (!isMoving) {
      return { x, y };
    }
    
    // Normalize input
    const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
    const nx = input.dx / len;
    const ny = input.dy / len;
    
    // Calculate speed
    const speed = input.sprint ? baseSpeed * sprintMultiplier : baseSpeed;
    
    // Apply movement
    return {
      x: x + nx * speed * deltaTime,
      y: y + ny * speed * deltaTime,
    };
  };
}
