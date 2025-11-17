interface Countdown { days: number; hours: number; minutes: number; seconds: number }

export default function CountdownTiles({ countdown }: { countdown: Countdown }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    }}>
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '15px',
        borderRadius: '12px',
        minWidth: '80px',
        border: '2px solid rgba(244, 67, 54, 0.3)'
      }}>
        <div style={{
          fontSize: '2em',
          fontWeight: 'bold',
          color: '#f44336',
          fontFamily: 'monospace'
        }}>
          {countdown.days}
        </div>
        <div style={{
          fontSize: '0.9em',
          color: '#ffccbc',
          textTransform: 'uppercase'
        }}>
          Days
        </div>
      </div>
      
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '15px',
        borderRadius: '12px',
        minWidth: '80px',
        border: '2px solid rgba(244, 67, 54, 0.3)'
      }}>
        <div style={{
          fontSize: '2em',
          fontWeight: 'bold',
          color: '#ff5722',
          fontFamily: 'monospace'
        }}>
          {countdown.hours}
        </div>
        <div style={{
          fontSize: '0.9em',
          color: '#ffccbc',
          textTransform: 'uppercase'
        }}>
          Hours
        </div>
      </div>
      
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '15px',
        borderRadius: '12px',
        minWidth: '80px',
        border: '2px solid rgba(244, 67, 54, 0.3)'
      }}>
        <div style={{
          fontSize: '2em',
          fontWeight: 'bold',
          color: '#ff7043',
          fontFamily: 'monospace'
        }}>
          {countdown.minutes}
        </div>
        <div style={{
          fontSize: '0.9em',
          color: '#ffccbc',
          textTransform: 'uppercase'
        }}>
          Minutes
        </div>
      </div>
      
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '15px',
        borderRadius: '12px',
        minWidth: '80px',
        border: '2px solid rgba(244, 67, 54, 0.3)'
      }}>
        <div style={{
          fontSize: '2em',
          fontWeight: 'bold',
          color: '#ff8a65',
          fontFamily: 'monospace'
        }}>
          {countdown.seconds}
        </div>
        <div style={{
          fontSize: '0.9em',
          color: '#ffccbc',
          textTransform: 'uppercase'
        }}>
          Seconds
        </div>
      </div>
    </div>
  );
}
