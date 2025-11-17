interface Props {
  isLaunched: boolean;
  serversOnline: { anarchy?: boolean };
  isMobile: boolean;
}

export default function AnarchyBanner({ isLaunched, serversOnline }: Props) {
  const online = !!serversOnline.anarchy;

  return (
    <>
      {isLaunched ? (
        // Server is live banner
        <div style={{
          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(27, 94, 32, 0.2))',
          border: '3px solid rgba(76, 175, 80, 0.5)',
          borderRadius: '20px',
          padding: '30px',
          marginBottom: '30px',
          textAlign: 'center',
          animation: online ? 'pulse 2s infinite' : 'none'
        }}>
          <h2 style={{ 
            color: '#4CAF50', 
            marginBottom: '15px', 
            fontSize: '2.5em',
            textShadow: '0 0 15px rgba(76, 175, 80, 0.5)',
            fontWeight: 'bold'
          }}>
            🚀 ANARCHY SERVER IS NOW LIVE! 🚀
          </h2>
          
          {/* Server Status Indicator */}
          <div style={{
            fontSize: '1.6em',
            color: online ? '#4CAF50' : '#ff9800',
            marginBottom: '20px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: online ? '#4CAF50' : '#ff9800',
              animation: online ? 'blink 1s infinite' : 'none'
            }} />
            {online ? 'SERVER ONLINE - JOIN NOW!' : 'SERVER OFFLINE'}
          </div>

          {/* Server IP Display */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '2px solid rgba(76, 175, 80, 0.5)',
            borderRadius: '15px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '2.2em',
              fontWeight: 'bold',
              color: '#4CAF50',
              marginBottom: '10px',
              fontFamily: 'monospace',
              textShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
            }}>
              play.bovisgl.xyz
            </div>
            <div style={{
              fontSize: '1.3em',
              color: '#8BC34A',
              fontWeight: 'bold'
            }}>
              Java & Bedrock Compatible
            </div>
          </div>
          
          <div style={{
            fontSize: '1.2em',
            color: '#c8e6c9',
            marginBottom: '10px'
          }}>
            The chaos has begun! Pure survival, griefing allowed, PvP enabled.
          </div>
          <div style={{
            fontSize: '1.1em',
            color: '#a5d6a7',
            fontStyle: 'italic'
          }}>
            Enhanced terrain • Quality of life commands • Crossplay enabled
          </div>
        </div>
      ) : (
        // Countdown banner
        <div style={{
          background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(183, 28, 28, 0.2))',
          border: '3px solid rgba(244, 67, 54, 0.5)',
          borderRadius: '20px',
          padding: '30px',
          marginBottom: '30px',
          textAlign: 'center',
          animation: 'pulse 2s infinite'
        }}>
          <h2 style={{ 
            color: '#f44336', 
            marginBottom: '15px', 
            fontSize: '2.5em',
            textShadow: '0 0 15px rgba(244, 67, 54, 0.5)',
            fontWeight: 'bold'
          }}>
            🔥 ANARCHY SERVER LAUNCHES SOON! 🔥
          </h2>
          <div style={{
            fontSize: '1.8em',
            color: '#ff5722',
            marginBottom: '15px',
            fontWeight: 'bold'
          }}>
            July 29th at Noon UTC-6
          </div>
          
          <div style={{
            fontSize: '1.2em',
            color: '#ffccbc',
            marginBottom: '10px'
          }}>
            Pure chaos awaits! No rules, no protections, pure survival gameplay.
          </div>
          <div style={{
            fontSize: '1.1em',
            color: '#ffab91',
            fontStyle: 'italic'
          }}>
            Griefing allowed • PvP enabled • Enhanced terrain • Quality of life commands
          </div>
        </div>
      )}
    </>
  );
}
