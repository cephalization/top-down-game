import { useEffect, useRef, useCallback } from 'react';
import { Game } from '../game/Game';
import { MultiplayerGame } from '../game/MultiplayerGame';
import type { GameConfig } from '../types';

export type GameInstance = Game | MultiplayerGame;

interface GameCanvasProps {
  config?: Partial<GameConfig>;
  onGameReady?: (game: GameInstance) => void;
  multiplayer?: {
    serverUrl: string;
    displayName: string;
    roomCode?: string;
  };
}

/**
 * Main game canvas component
 * Handles canvas setup and game lifecycle for both single and multiplayer
 */
export function GameCanvas({ config, onGameReady, multiplayer }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initGame = useCallback(() => {
    if (!canvasRef.current || gameRef.current) return;

    if (multiplayer) {
      // Multiplayer mode
      const game = new MultiplayerGame(
        canvasRef.current,
        {
          serverUrl: multiplayer.serverUrl,
          displayName: multiplayer.displayName,
          roomCode: multiplayer.roomCode,
        },
        config,
        {
          onConnect: (welcome) => {
            console.log(`Connected to room ${welcome.roomCode}`);
          },
          onDisconnect: (reason) => {
            console.log(`Disconnected: ${reason}`);
          },
          onPlayerJoin: (join) => {
            console.log(`${join.player.displayName} joined`);
          },
          onPlayerLeave: (playerId) => {
            console.log(`Player ${playerId} left`);
          },
        }
      );
      gameRef.current = game;
      game.start();
      onGameReady?.(game);
    } else {
      // Single player mode
      const game = new Game(canvasRef.current, config);
      gameRef.current = game;
      game.start();
      onGameReady?.(game);
    }
  }, [config, onGameReady, multiplayer]);

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
