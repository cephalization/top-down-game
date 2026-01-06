/**
 * InputBuffer - Manages pending inputs for client-side prediction
 * Stores inputs with sequence numbers for reconciliation with server
 */

import type { PlayerInput } from '../shared/protocol';
import { MAX_PENDING_INPUTS } from '../shared/protocol';

export interface PendingInput {
  seq: number;
  tick: number;
  input: PlayerInput;
  timestamp: number;
  // Position after applying this input (for reconciliation)
  predictedX: number;
  predictedY: number;
}

export class InputBuffer {
  private pendingInputs: PendingInput[] = [];
  private currentSeq: number = 0;
  
  /**
   * Add a new input to the buffer
   * Returns the sequence number assigned to this input
   */
  push(input: PlayerInput, tick: number, predictedX: number, predictedY: number): number {
    const seq = ++this.currentSeq;
    
    const pendingInput: PendingInput = {
      seq,
      tick,
      input,
      timestamp: performance.now(),
      predictedX,
      predictedY,
    };
    
    this.pendingInputs.push(pendingInput);
    
    // Prevent buffer from growing too large
    while (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs.shift();
    }
    
    return seq;
  }
  
  /**
   * Acknowledge inputs up to and including the given sequence number
   * Removes acknowledged inputs from the buffer
   * Returns the acknowledged inputs
   */
  acknowledge(lastProcessedSeq: number): PendingInput[] {
    const acknowledged: PendingInput[] = [];
    
    while (this.pendingInputs.length > 0 && this.pendingInputs[0].seq <= lastProcessedSeq) {
      acknowledged.push(this.pendingInputs.shift()!);
    }
    
    return acknowledged;
  }
  
  /**
   * Get all pending (unacknowledged) inputs
   * Used for reconciliation - these inputs need to be re-applied after snapping to server position
   */
  getPending(): PendingInput[] {
    return [...this.pendingInputs];
  }
  
  /**
   * Get the number of pending inputs
   */
  getPendingCount(): number {
    return this.pendingInputs.length;
  }
  
  /**
   * Get the current sequence number
   */
  getCurrentSeq(): number {
    return this.currentSeq;
  }
  
  /**
   * Get the oldest pending input's sequence number (or -1 if empty)
   */
  getOldestPendingSeq(): number {
    return this.pendingInputs.length > 0 ? this.pendingInputs[0].seq : -1;
  }
  
  /**
   * Get the newest pending input's sequence number (or -1 if empty)
   */
  getNewestPendingSeq(): number {
    return this.pendingInputs.length > 0 
      ? this.pendingInputs[this.pendingInputs.length - 1].seq 
      : -1;
  }
  
  /**
   * Clear all pending inputs
   */
  clear(): void {
    this.pendingInputs = [];
  }
  
  /**
   * Reset the buffer entirely (including sequence counter)
   */
  reset(): void {
    this.pendingInputs = [];
    this.currentSeq = 0;
  }
  
  /**
   * Get statistics for debugging
   */
  getStats(): {
    pendingCount: number;
    currentSeq: number;
    oldestSeq: number;
    newestSeq: number;
    oldestAge: number;
  } {
    const now = performance.now();
    const oldestAge = this.pendingInputs.length > 0 
      ? now - this.pendingInputs[0].timestamp 
      : 0;
      
    return {
      pendingCount: this.pendingInputs.length,
      currentSeq: this.currentSeq,
      oldestSeq: this.getOldestPendingSeq(),
      newestSeq: this.getNewestPendingSeq(),
      oldestAge,
    };
  }
}
