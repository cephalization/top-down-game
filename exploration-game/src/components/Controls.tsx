/**
 * Controls info overlay - shows keyboard controls
 */
export function Controls() {
  return (
    <div style={styles.container}>
      <div style={styles.title}>Controls</div>
      <div style={styles.control}>
        <span style={styles.key}>W A S D</span>
        <span style={styles.action}>Move</span>
      </div>
      <div style={styles.control}>
        <span style={styles.key}>Shift</span>
        <span style={styles.action}>Sprint</span>
      </div>
      <div style={styles.control}>
        <span style={styles.key}>ESC</span>
        <span style={styles.action}>Pause</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '12px 16px',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  title: {
    color: 'white',
    fontFamily: 'sans-serif',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
  },
  control: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  key: {
    color: '#a5b4fc',
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    padding: '2px 6px',
    borderRadius: 3,
    minWidth: 60,
    textAlign: 'center',
  },
  action: {
    color: 'white',
    fontFamily: 'sans-serif',
    fontSize: 12,
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
  },
};
