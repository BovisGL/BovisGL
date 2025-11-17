export default function HowToJoinCard({ isMobile }: { isMobile: boolean }) {
  return (
    <div id="how-to-join" style={{
      background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(139, 195, 74, 0.1))',
      border: '2px solid rgba(76, 175, 80, 0.3)',
      borderRadius: '15px',
      padding: '25px',
      textAlign: 'center',
      marginBottom: '30px'
    }}>
      <h2 style={{ 
        color: '#4CAF50', 
        marginBottom: '20px', 
        fontSize: '1.8em'
      }}>
        🎯 How to Join
      </h2>
      <p style={{ marginBottom: '25px', fontSize: '1.2em', lineHeight: '1.6' }}>
        Connect to our network using this server address:
      </p>
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '2px solid rgba(76, 175, 80, 0.5)',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          fontSize: '2em',
          fontWeight: 'bold',
          color: '#4CAF50',
          marginBottom: '10px',
          fontFamily: 'monospace',
          textShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
        }}>
          play.bovisgl.xyz
        </div>
        <p style={{ 
          fontSize: '1.1em', 
          color: '#8BC34A',
          marginBottom: '15px'
        }}>
          Works for both Java Edition and Bedrock Edition
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '15px',
          marginTop: '15px'
        }}>
          <div style={{
            background: 'rgba(33, 150, 243, 0.2)',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid rgba(33, 150, 243, 0.3)'
          }}>
            <h4 style={{ color: '#2196F3', marginBottom: '8px', fontSize: '1.1em' }}>
              Java Edition
            </h4>
            <p style={{ fontSize: '0.9em', color: '#e0e0e0' }}>
              Add to your server list<br/>
              Versions: 1.17+ (to latest)
            </p>
          </div>
          <div style={{
            background: 'rgba(156, 39, 176, 0.2)',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid rgba(156, 39, 176, 0.3)'
          }}>
            <h4 style={{ color: '#9C27B0', marginBottom: '8px', fontSize: '1.1em' }}>
              Bedrock Edition
            </h4>
            <p style={{ fontSize: '0.9em', color: '#e0e0e0' }}>
              Add to your server list<br/>
              Port: 19132 (default)
            </p>
            <div style={{
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '6px',
              padding: '10px',
              marginTop: '10px'
            }}>
              <p style={{ fontSize: '0.85em', color: '#FFD54F', marginBottom: '5px' }}>
                <strong>⚠️ Limited Server List?</strong>
              </p>
              <p style={{ fontSize: '0.8em', color: '#e0e0e0' }}>
                If your Bedrock client only shows featured servers, add "BovisGL" as a friend, then join their world to connect!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
