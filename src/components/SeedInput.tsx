import { useState } from 'react';
import type { Game } from '../game/Game';

interface SeedInputProps {
  game: Game | null;
}

/**
 * Seed input component - allows changing the world seed
 */
export function SeedInput({ game }: SeedInputProps) {
  const [seed, setSeed] = useState(game?.getConfig().seed.toString() ?? '');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (game && seed) {
      const numericSeed = parseInt(seed, 10) || Date.now();
      game.setSeed(numericSeed);
      setSeed(numericSeed.toString());
      setIsOpen(false);
    }
  };

  const handleRandomize = () => {
    const newSeed = Date.now();
    setSeed(newSeed.toString());
    if (game) {
      game.setSeed(newSeed);
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={styles.toggleButton}
      >
        🌱 Seed
      </button>
    );
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed..."
          style={styles.input}
        />
        <button type="submit" style={styles.button}>
          Apply
        </button>
        <button
          type="button"
          onClick={handleRandomize}
          style={styles.button}
        >
          Random
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={styles.closeButton}
        >
          ✕
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toggleButton: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'sans-serif',
    fontSize: 14,
  },
  container: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  form: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    fontFamily: 'monospace',
    fontSize: 14,
    width: 120,
    outline: 'none',
  },
  button: {
    padding: '6px 12px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#4f46e5',
    color: 'white',
    cursor: 'pointer',
    fontFamily: 'sans-serif',
    fontSize: 12,
  },
  closeButton: {
    padding: '4px 8px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: 'white',
    cursor: 'pointer',
    fontSize: 16,
  },
};
