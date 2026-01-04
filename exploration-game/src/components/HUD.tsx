import { useState, useEffect } from 'react';
import type { Game } from '../game/Game';

interface HUDProps {
  game: Game | null;
}

/**
 * Heads-Up Display component
 * Shows player stats, coordinates, and other info
 */
export function HUD({ game }: HUDProps) {
  const [stats, setStats] = useState({
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
  });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [biome, setBiome] = useState('Unknown');

  useEffect(() => {
    if (!game) return;

    const updateInterval = setInterval(() => {
      const player = game.getPlayer();
      const world = game.getWorld();
      const playerPos = player.getPosition();
      
      setStats(player.getStats());
      setPosition({ x: Math.floor(playerPos.x), y: Math.floor(playerPos.y) });

      // Get current biome
      const chunk = world.getChunkAt(playerPos);
      if (chunk) {
        setBiome(chunk.getBiome());
      }
    }, 100);

    return () => clearInterval(updateInterval);
  }, [game]);

  if (!game) return null;

  return (
    <div style={styles.container}>
      {/* Health bar */}
      <div style={styles.barContainer}>
        <div style={styles.barLabel}>HP</div>
        <div style={styles.barBackground}>
          <div
            style={{
              ...styles.barFill,
              width: `${(stats.health / stats.maxHealth) * 100}%`,
              backgroundColor: '#ef4444',
            }}
          />
        </div>
        <div style={styles.barValue}>
          {Math.floor(stats.health)}/{stats.maxHealth}
        </div>
      </div>

      {/* Stamina bar */}
      <div style={styles.barContainer}>
        <div style={styles.barLabel}>SP</div>
        <div style={styles.barBackground}>
          <div
            style={{
              ...styles.barFill,
              width: `${(stats.stamina / stats.maxStamina) * 100}%`,
              backgroundColor: '#22c55e',
            }}
          />
        </div>
        <div style={styles.barValue}>
          {Math.floor(stats.stamina)}/{stats.maxStamina}
        </div>
      </div>

      {/* Position and biome info */}
      <div style={styles.infoContainer}>
        <div style={styles.infoText}>
          📍 {position.x}, {position.y}
        </div>
        <div style={styles.infoText}>
          🌍 {biome.charAt(0).toUpperCase() + biome.slice(1)}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  barContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    color: 'white',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    width: 24,
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
  },
  barBackground: {
    width: 150,
    height: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  barFill: {
    height: '100%',
    transition: 'width 0.2s ease-out',
  },
  barValue: {
    color: 'white',
    fontFamily: 'monospace',
    fontSize: 11,
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
    minWidth: 60,
  },
  infoContainer: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  infoText: {
    color: 'white',
    fontFamily: 'monospace',
    fontSize: 12,
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
  },
};
