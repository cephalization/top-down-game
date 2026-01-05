import { useState } from 'react';

export interface MultiplayerConfig {
  mode: 'singleplayer' | 'multiplayer';
  displayName: string;
  roomCode: string;
  serverUrl: string;
}

interface MultiplayerMenuProps {
  onStart: (config: MultiplayerConfig) => void;
}

/**
 * Menu for selecting game mode and entering multiplayer details
 */
export function MultiplayerMenu({ onStart }: MultiplayerMenuProps) {
  const [mode, setMode] = useState<'singleplayer' | 'multiplayer'>('singleplayer');
  const [displayName, setDisplayName] = useState('Player');
  const [roomCode, setRoomCode] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://localhost:3001/ws');

  const handleStart = () => {
    onStart({
      mode,
      displayName: displayName.trim() || 'Player',
      roomCode: roomCode.trim().toUpperCase(),
      serverUrl,
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.menu}>
        <h1 style={styles.title}>Exploration Game</h1>
        
        <div style={styles.modeSelector}>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === 'singleplayer' ? styles.modeButtonActive : {}),
            }}
            onClick={() => setMode('singleplayer')}
          >
            Single Player
          </button>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === 'multiplayer' ? styles.modeButtonActive : {}),
            }}
            onClick={() => setMode('multiplayer')}
          >
            Multiplayer
          </button>
        </div>

        {mode === 'multiplayer' && (
          <div style={styles.multiplayerOptions}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                style={styles.input}
                maxLength={20}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Room Code (leave empty to create new)</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g., ABCD"
                style={styles.input}
                maxLength={4}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Server URL</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        )}

        <button style={styles.startButton} onClick={handleStart}>
          {mode === 'singleplayer' ? 'Start Game' : roomCode ? 'Join Room' : 'Create Room'}
        </button>

        <div style={styles.controls}>
          <h3 style={styles.controlsTitle}>Controls</h3>
          <p style={styles.controlsText}>WASD / Arrow Keys - Move</p>
          <p style={styles.controlsText}>Shift - Sprint</p>
          <p style={styles.controlsText}>Ctrl+D - Debug Panel</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  menu: {
    backgroundColor: '#16213e',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    maxWidth: '400px',
    width: '90%',
  },
  title: {
    color: '#e94560',
    textAlign: 'center',
    marginBottom: '30px',
    fontSize: '28px',
    fontWeight: 'bold',
  },
  modeSelector: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  modeButton: {
    flex: 1,
    padding: '12px',
    border: '2px solid #0f3460',
    backgroundColor: 'transparent',
    color: '#e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  modeButtonActive: {
    backgroundColor: '#0f3460',
    borderColor: '#e94560',
    color: '#ffffff',
  },
  multiplayerOptions: {
    marginBottom: '20px',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    color: '#a0a0a0',
    marginBottom: '5px',
    fontSize: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#1a1a2e',
    border: '2px solid #0f3460',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  startButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#e94560',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginBottom: '20px',
  },
  controls: {
    borderTop: '1px solid #0f3460',
    paddingTop: '20px',
  },
  controlsTitle: {
    color: '#a0a0a0',
    fontSize: '14px',
    marginBottom: '10px',
  },
  controlsText: {
    color: '#707070',
    fontSize: '12px',
    margin: '5px 0',
  },
};
