import { Pane, FolderApi } from "tweakpane";

/**
 * Debug stats that are monitored (readonly)
 */
export interface DebugStats {
  // Performance
  fps: number;
  frameTime: number;
  avgFrameTime: number;
  minFps: number;
  maxFps: number;

  // World
  chunks: number;
  entities: number;
  seed: number;

  // Player
  playerX: number;
  playerY: number;

  // Camera
  cameraX: number;
  cameraY: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  
  // Network (optional)
  rtt?: number;
  pendingInputs?: number;
  remotePlayers?: number;
}

/**
 * Tweakpane-based debug panel for monitoring game stats
 * and tweaking parameters
 */
export class DebugPanel {
  private pane: Pane;
  private stats: DebugStats;
  private visible: boolean = false;

  // Folder references for organization
  private performanceFolder: FolderApi;
  private worldFolder: FolderApi;
  private playerFolder: FolderApi;
  private cameraFolder: FolderApi;
  private tweaksFolder: FolderApi;

  constructor() {
    // Initialize stats with default values
    this.stats = {
      fps: 0,
      frameTime: 0,
      avgFrameTime: 0,
      minFps: 0,
      maxFps: 0,
      chunks: 0,
      entities: 0,
      seed: 0,
      playerX: 0,
      playerY: 0,
      cameraX: 0,
      cameraY: 0,
      zoom: 1,
      viewportWidth: 0,
      viewportHeight: 0,
    };

    // Create the pane
    this.pane = new Pane({
      title: "Debug Panel",
      expanded: true,
    });

    // Style the container
    const container = this.pane.element.parentElement;
    if (container) {
      container.style.position = "fixed";
      container.style.top = "10px";
      container.style.right = "170px"; // Offset from minimap
      container.style.zIndex = "1000";
    }

    // Create folders
    this.performanceFolder = this.pane.addFolder({
      title: "Performance",
      expanded: true,
    });

    this.worldFolder = this.pane.addFolder({
      title: "World",
      expanded: true,
    });

    this.playerFolder = this.pane.addFolder({
      title: "Player",
      expanded: true,
    });

    this.cameraFolder = this.pane.addFolder({
      title: "Camera",
      expanded: false,
    });

    // Tweaks folder for user-added parameters
    this.tweaksFolder = this.pane.addFolder({
      title: "Tweaks",
      expanded: true,
    });

    // Set up monitors
    this.setupMonitors();

    // Initially hidden
    this.hide();
  }

  /**
   * Set up readonly monitor bindings
   */
  private setupMonitors(): void {
    // Performance monitors
    this.performanceFolder.addBinding(this.stats, "fps", {
      readonly: true,
      label: "FPS",
      view: "graph",
      min: 0,
      max: 999,
    });

    this.performanceFolder.addBinding(this.stats, "frameTime", {
      readonly: true,
      label: "Frame (ms)",
      format: (v) => v.toFixed(2),
    });

    this.performanceFolder.addBinding(this.stats, "avgFrameTime", {
      readonly: true,
      label: "Avg Frame",
      format: (v) => v.toFixed(2) + "ms",
    });

    this.performanceFolder.addBinding(this.stats, "minFps", {
      readonly: true,
      label: "Min FPS",
    });

    this.performanceFolder.addBinding(this.stats, "maxFps", {
      readonly: true,
      label: "Max FPS",
    });

    // World monitors
    this.worldFolder.addBinding(this.stats, "chunks", {
      readonly: true,
      label: "Chunks",
    });

    this.worldFolder.addBinding(this.stats, "entities", {
      readonly: true,
      label: "Entities",
    });

    this.worldFolder.addBinding(this.stats, "seed", {
      readonly: true,
      label: "Seed",
    });

    // Player monitors
    this.playerFolder.addBinding(this.stats, "playerX", {
      readonly: true,
      label: "X",
      format: (v) => Math.floor(v).toString(),
    });

    this.playerFolder.addBinding(this.stats, "playerY", {
      readonly: true,
      label: "Y",
      format: (v) => Math.floor(v).toString(),
    });

    // Camera monitors
    this.cameraFolder.addBinding(this.stats, "cameraX", {
      readonly: true,
      label: "X",
      format: (v) => Math.floor(v).toString(),
    });

    this.cameraFolder.addBinding(this.stats, "cameraY", {
      readonly: true,
      label: "Y",
      format: (v) => Math.floor(v).toString(),
    });

    this.cameraFolder.addBinding(this.stats, "zoom", {
      readonly: true,
      label: "Zoom",
      format: (v) => v.toFixed(2) + "x",
    });

    this.cameraFolder.addBinding(this.stats, "viewportWidth", {
      readonly: true,
      label: "Viewport",
      format: (v) => `${v}x${this.stats.viewportHeight}`,
    });

    // Add a button to reset FPS stats as an example
    this.tweaksFolder
      .addButton({
        title: "Reset FPS Stats",
      })
      .on("click", () => {
        this.stats.minFps = 0;
        this.stats.maxFps = 0;
      });
  }

  /**
   * Update all monitored stats
   */
  updateStats(stats: Partial<DebugStats>): void {
    Object.assign(this.stats, stats);
    this.pane.refresh();
  }

  /**
   * Show the debug panel
   */
  show(): void {
    this.visible = true;
    const container = this.pane.element.parentElement;
    if (container) {
      container.style.display = "block";
    }
  }

  /**
   * Hide the debug panel
   */
  hide(): void {
    this.visible = false;
    const container = this.pane.element.parentElement;
    if (container) {
      container.style.display = "none";
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if panel is visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Get the tweaks folder for adding custom parameters
   * Usage example:
   *   const tweaks = debugPanel.getTweaksFolder();
   *   tweaks.addBinding(params, 'speed', { min: 0, max: 500 });
   */
  getTweaksFolder(): FolderApi {
    return this.tweaksFolder;
  }

  /**
   * Get the main pane for advanced customization
   */
  getPane(): Pane {
    return this.pane;
  }

  /**
   * Add a new folder to the panel
   */
  addFolder(title: string, expanded: boolean = true): FolderApi {
    return this.pane.addFolder({ title, expanded });
  }

  /**
   * Dispose of the panel
   */
  dispose(): void {
    this.pane.dispose();
  }
}
