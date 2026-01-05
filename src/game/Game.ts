import type { GameConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { InputManager } from './InputManager';
import { Camera } from './Camera';
import { World } from '../world/World';
import { Player } from '../entities/Player';
import { Renderer } from '../rendering/Renderer';
import { Rect } from '../utils/math';
import { DebugPanel } from './DebugPanel';

export interface GameCallbacks {
  onUpdate?: (deltaTime: number) => void;
  onPause?: () => void;
  onResume?: () => void;
}

/**
 * Main Game class - orchestrates all game systems
 */
export class Game {
  private config: GameConfig;
  private canvas: HTMLCanvasElement;
  private inputManager: InputManager;
  private camera: Camera;
  private world: World;
  private player: Player;
  private renderer: Renderer;
  private callbacks: GameCallbacks;
  private debugPanel: DebugPanel;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;

  // Performance tracking
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private frameTime: number = 0;
  private minFps: number = Infinity;
  private maxFps: number = 0;
  private frameTimes: number[] = [];

  // Debug toggle
  private debugToggleDebounce: boolean = false;

  constructor(canvas: HTMLCanvasElement, config: Partial<GameConfig> = {}, callbacks: GameCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvas = canvas;
    this.callbacks = callbacks;

    // Initialize systems
    this.inputManager = new InputManager();
    this.camera = new Camera();
    this.world = new World(this.config);
    this.player = new Player({ x: 0, y: 0 }, this.config.playerSpeed);
    this.renderer = new Renderer(canvas, this.camera);
    this.debugPanel = new DebugPanel();

    // Bind methods
    this.gameLoop = this.gameLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Initialize and start the game
   */
  start(): void {
    if (this.isRunning) return;

    // Initialize input
    this.inputManager.initialize(this.canvas);

    // Set up resize handler
    window.addEventListener('resize', this.handleResize);
    this.handleResize();

    // Initialize camera at player position
    this.camera.snapToTarget(this.player.getCenter());

    // Initial world update
    this.world.update(this.player.getPosition());

    // Start game loop
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Stop the game
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('resize', this.handleResize);
    this.inputManager.destroy();
    this.debugPanel.dispose();
  }

  /**
   * Pause the game
   */
  pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.callbacks.onPause?.();
    }
  }

  /**
   * Resume the game
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTime = performance.now();
      this.callbacks.onResume?.();
    }
  }

  /**
   * Toggle pause state
   */
  togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Main game loop
   */
  private gameLoop(currentTime: number): void {
    if (!this.isRunning) return;

    // Calculate delta time (in seconds)
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    // Track frame time for debug overlay
    this.frameTime = deltaTime * 1000; // Convert to ms
    this.frameTimes.push(this.frameTime);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // FPS calculation
    this.frameCount++;
    this.fpsTime += deltaTime;
    if (this.fpsTime >= 1) {
      this.fps = this.frameCount;
      this.minFps = Math.min(this.minFps, this.fps);
      this.maxFps = Math.max(this.maxFps, this.fps);
      this.frameCount = 0;
      this.fpsTime = 0;
    }

    // Check for debug toggle (Ctrl+D)
    if (this.inputManager.isDebugTogglePressed()) {
      if (!this.debugToggleDebounce) {
        this.debugPanel.toggle();
        this.debugToggleDebounce = true;
      }
    } else {
      this.debugToggleDebounce = false;
    }

    // Update debug panel stats
    if (this.debugPanel.isVisible()) {
      const avgFrameTime = this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;
      const playerPos = this.player.getPosition();
      const cameraPos = this.camera.getPosition();
      const viewport = this.camera.getViewport();

      this.debugPanel.updateStats({
        fps: this.fps,
        frameTime: this.frameTime,
        avgFrameTime,
        minFps: this.minFps === Infinity ? 0 : this.minFps,
        maxFps: this.maxFps,
        chunks: this.world.getLoadedChunks().length,
        entities: this.world.getEntities().length,
        seed: this.config.seed,
        playerX: playerPos.x,
        playerY: playerPos.y,
        cameraX: cameraPos.x,
        cameraY: cameraPos.y,
        zoom: this.camera.getZoom(),
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      });
    }

    // Check for pause toggle
    if (this.inputManager.isActionPressed('pause')) {
      // Debounce pause toggle
      if (!this.isPaused) {
        this.togglePause();
      }
    }

    if (!this.isPaused) {
      this.update(deltaTime);
    }

    this.render();

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    // Get player input
    const movement = this.inputManager.getMovementDirection();
    const sprinting = this.inputManager.isSprinting();

    // Store old position for collision resolution
    const oldPosition = this.player.getPosition();

    // Update player
    this.player.setMovementInput(movement, sprinting);
    this.player.update(deltaTime);

    // Check collisions
    if (this.checkPlayerCollision()) {
      // Simple collision resolution - revert to old position
      this.player.setPosition(oldPosition);
    }

    // Check walkability
    const playerCenter = this.player.getCenter();
    if (!this.world.isWalkable(playerCenter)) {
      this.player.setPosition(oldPosition);
    }

    // Update camera to follow player
    this.camera.setTarget(this.player.getCenter());
    this.camera.update(deltaTime);

    // Update world (load/unload chunks)
    this.world.update(this.player.getPosition());

    // Call custom update callback
    this.callbacks.onUpdate?.(deltaTime);
  }

  /**
   * Check if player collides with any entities
   */
  private checkPlayerCollision(): boolean {
    const playerBounds = this.player.getBounds();
    const nearbyEntities = this.world.getCollidableEntitiesNear(
      this.player.getCenter(),
      100
    );

    for (const entity of nearbyEntities) {
      if (Rect.intersects(playerBounds, entity.getBounds())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Render the game
   */
  private render(): void {
    this.renderer.render(this.world, this.player);

    // Render minimap
    const { width, height } = this.renderer.getDimensions();
    this.renderer.renderMinimap(this.world, this.player, width - 160, 10, 150);

    const ctx = this.renderer.getContext();

    // Render simple FPS counter when debug panel is hidden
    if (!this.debugPanel.isVisible()) {
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.fillText(`FPS: ${this.fps}`, 10, height - 10);
    } else {
      // Show hint when debug is visible
      ctx.fillStyle = '#888888';
      ctx.font = '11px monospace';
      ctx.fillText('Press Ctrl+D to hide debug panel', 10, height - 10);
    }

    // Render pause overlay
    if (this.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', width / 2, height / 2);
      ctx.font = '18px sans-serif';
      ctx.fillText('Press ESC to resume', width / 2, height / 2 + 40);
      ctx.textAlign = 'left';
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.renderer.resize(parent.clientWidth, parent.clientHeight);
    }
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Get player reference
   */
  getPlayer(): Player {
    return this.player;
  }

  /**
   * Get world reference
   */
  getWorld(): World {
    return this.world;
  }

  /**
   * Get config
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Check if game is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if game is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Set a new seed and regenerate world
   */
  setSeed(seed: number): void {
    this.config.seed = seed;
    this.world = new World(this.config);
    this.player.setPosition({ x: 0, y: 0 });
    this.camera.snapToTarget(this.player.getCenter());
    this.world.update(this.player.getPosition());
  }

  /**
   * Toggle debug panel
   */
  toggleDebug(): void {
    this.debugPanel.toggle();
  }

  /**
   * Check if debug panel is visible
   */
  isDebugEnabled(): boolean {
    return this.debugPanel.isVisible();
  }

  /**
   * Get the debug panel for adding custom tweaks
   * Usage:
   *   const panel = game.getDebugPanel();
   *   const tweaks = panel.getTweaksFolder();
   *   tweaks.addBinding(myObject, 'speed', { min: 0, max: 100 });
   */
  getDebugPanel(): DebugPanel {
    return this.debugPanel;
  }

  /**
   * Reset performance stats
   */
  resetPerformanceStats(): void {
    this.minFps = Infinity;
    this.maxFps = 0;
    this.frameTimes = [];
  }
}
