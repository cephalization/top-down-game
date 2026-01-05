import { useState, useCallback } from 'react';
import { GameCanvas, HUD, Controls, SeedInput } from './components';
import { Game } from './game/Game';
import './App.css';

const CONFIG = {
  seed: 12345
}

function App() {
  const [game, setGame] = useState<Game | null>(null);

  const handleGameReady = useCallback((gameInstance: Game) => {
    setGame(gameInstance);
  }, []);

  return (
    <div className="app">
      <GameCanvas 
        config={CONFIG} 
        onGameReady={handleGameReady} 
      />
      <HUD game={game} />
      <Controls />
      <SeedInput game={game} />
    </div>
  );
}

export default App;
