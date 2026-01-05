import { useEffect, useRef, useCallback } from 'react';
import { Game } from '../game/Game';
import type { GameConfig } from '../types';

interface GameCanvasProps {
  config?: Partial<GameConfig>;
  onGameReady?: (game: Game) => void;
}

/**
 * Main game canvas component
 * Handles canvas setup and game lifecycle
 */
export function GameCanvas({ config, onGameReady }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initGame = useCallback(() => {
    if (!canvasRef.current || gameRef.current) return;

    const game = new Game(canvasRef.current, config);
    gameRef.current = game;
    game.start();

    onGameReady?.(game);
  }, [config, onGameReady]);

  useEffect(() => {
    initGame();

    return () => {
      if (gameRef.current) {
        gameRef.current.stop();
        gameRef.current = null;
      }
    };
  }, [initGame]);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#1a1a2e',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
