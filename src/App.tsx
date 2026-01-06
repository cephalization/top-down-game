import { useState, useCallback } from 'react';
import { GameCanvas, HUD, Controls, SeedInput } from './components';
import { MultiplayerMenu, type MultiplayerConfig } from './components/MultiplayerMenu';
import { Game } from './game/Game';
import { MultiplayerGame } from './game/MultiplayerGame';
import type { GameInstance } from './components/GameCanvas';
import './App.css';

const CONFIG = {
  seed: 12345
}

function App() {
  const [game, setGame] = useState<GameInstance | null>(null);
  const [gameConfig, setGameConfig] = useState<MultiplayerConfig | null>(null);

  const handleGameReady = useCallback((gameInstance: GameInstance) => {
    setGame(gameInstance);
  }, []);

  const handleStart = useCallback((config: MultiplayerConfig) => {
    setGameConfig(config);
  }, []);

  const handleBackToMenu = useCallback(() => {
    if (game) {
      game.stop();
      setGame(null);
    }
    setGameConfig(null);
  }, [game]);

  // Show menu if no game config yet
  if (!gameConfig) {
    return <MultiplayerMenu onStart={handleStart} />;
  }

  // Determine multiplayer props
  const multiplayerProps = gameConfig.mode === 'multiplayer' 
    ? {
        serverUrl: gameConfig.serverUrl,
        displayName: gameConfig.displayName,
        roomCode: gameConfig.roomCode || undefined,
      }
    : undefined;

  return (
    <div className="app">
      <GameCanvas 
        config={CONFIG} 
        onGameReady={handleGameReady}
        multiplayer={multiplayerProps}
      />
      <HUD game={game} />
      <Controls />
      {game instanceof Game && <SeedInput game={game} />}
      
      {/* Back to menu button */}
      <button
        onClick={handleBackToMenu}
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          padding: '8px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 100,
          fontSize: '12px',
        }}
      >
        ← Menu
      </button>

      {/* Show room code and player info for multiplayer */}
      {game instanceof MultiplayerGame && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            left: '80px',
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            borderRadius: '4px',
            zIndex: 100,
            fontSize: '12px',
          }}
        >
          <strong>Room:</strong> {game.getRoomCode() || 'Connecting...'}
          {' | '}
          <strong>Players:</strong> {game.getPlayerCount()}
        </div>
      )}
    </div>
  );
}

export default App;
