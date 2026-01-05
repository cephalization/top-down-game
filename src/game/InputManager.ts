import type { Vector2, InputState } from "../types";

/**
 * Handles all keyboard and mouse input
 * Extensible for adding new input methods (gamepad, touch, etc.)
 */
export class InputManager {
  private state: InputState = {
    keys: new Set(),
    mousePosition: { x: 0, y: 0 },
    mouseButtons: new Set(),
  };

  private canvas: HTMLCanvasElement | null = null;

  // Key bindings (can be customized)
  readonly bindings = {
    moveUp: ["w", "W", "ArrowUp"],
    moveDown: ["s", "S", "ArrowDown"],
    moveLeft: ["a", "A", "ArrowLeft"],
    moveRight: ["d", "D", "ArrowRight"],
    interact: ["e", "E", " "],
    pause: ["Escape", "p", "P"],
    sprint: ["Shift"],
    debug: ["d", "D"],
  };

  // Track Ctrl key state
  private ctrlPressed: boolean = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  /**
   * Initialize input listeners
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("mouseup", this.handleMouseUp);
    canvas.addEventListener("contextmenu", this.handleContextMenu);
  }

  /**
   * Clean up input listeners
   */
  destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);

    if (this.canvas) {
      this.canvas.removeEventListener("mousemove", this.handleMouseMove);
      this.canvas.removeEventListener("mousedown", this.handleMouseDown);
      this.canvas.removeEventListener("mouseup", this.handleMouseUp);
      this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.state.keys.add(event.key);
    if (event.key === "Control") {
      this.ctrlPressed = true;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.state.keys.delete(event.key);
    if (event.key === "Control") {
      this.ctrlPressed = false;
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.state.mousePosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private handleMouseDown(event: MouseEvent): void {
    this.state.mouseButtons.add(event.button);
  }

  private handleMouseUp(event: MouseEvent): void {
    this.state.mouseButtons.delete(event.button);
  }

  private handleContextMenu(event: Event): void {
    event.preventDefault();
  }

  /**
   * Check if a key is currently pressed
   */
  isKeyDown(key: string): boolean {
    return this.state.keys.has(key);
  }

  /**
   * Check if any of the keys for an action are pressed
   */
  isActionPressed(action: keyof typeof this.bindings): boolean {
    return this.bindings[action].some((key) => this.state.keys.has(key));
  }

  /**
   * Get the movement direction based on input
   */
  getMovementDirection(): Vector2 {
    let x = 0;
    let y = 0;

    // If Ctrl is not pressed, use WASD keys for movement
    if (!this.isCtrlPressed()) {
      if (this.isActionPressed("moveUp")) y -= 1;
      if (this.isActionPressed("moveDown")) y += 1;
      if (this.isActionPressed("moveLeft")) x -= 1;
      if (this.isActionPressed("moveRight")) x += 1;
    }

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  /**
   * Check if sprinting
   */
  isSprinting(): boolean {
    return this.isActionPressed("sprint");
  }

  /**
   * Get current mouse position
   */
  getMousePosition(): Vector2 {
    return { ...this.state.mousePosition };
  }

  /**
   * Check if a mouse button is pressed
   * 0 = left, 1 = middle, 2 = right
   */
  isMouseButtonDown(button: number): boolean {
    return this.state.mouseButtons.has(button);
  }

  /**
   * Get all currently pressed keys (for debugging)
   */
  getPressedKeys(): string[] {
    return Array.from(this.state.keys);
  }

  /**
   * Check if Ctrl key is pressed
   */
  isCtrlPressed(): boolean {
    return this.ctrlPressed;
  }

  /**
   * Check if debug toggle (Ctrl+D) is pressed
   */
  isDebugTogglePressed(): boolean {
    return this.ctrlPressed && this.isActionPressed("debug");
  }
}
