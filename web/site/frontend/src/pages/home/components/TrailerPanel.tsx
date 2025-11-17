export default function TrailerPanel({ isLaunched }: { isLaunched: boolean }) {
  return (
    <div style={{
      background: isLaunched ? 
        'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(27, 94, 32, 0.1))' :
        'linear-gradient(135deg, rgba(255, 87, 34, 0.1), rgba(244, 67, 54, 0.1))',
      border: isLaunched ? 
        '2px solid rgba(76, 175, 80, 0.3)' :
        '2px solid rgba(255, 87, 34, 0.3)',
      borderRadius: '15px',
      padding: '30px',
      marginBottom: '30px',
      textAlign: 'center'
    }}>
      <h2 style={{ 
        color: isLaunched ? '#4CAF50' : '#FF5722', 
        marginBottom: '20px', 
        fontSize: '2em',
        textShadow: isLaunched ? 
          '0 0 10px rgba(76, 175, 80, 0.5)' :
          '0 0 10px rgba(255, 87, 34, 0.5)'
      }}>
        {isLaunched ? '🎮 Join the Chaos Now!' : '🎬 Official Trailer'}
      </h2>
      <p style={{ 
        fontSize: '1.2em', 
        marginBottom: '25px', 
        color: isLaunched ? '#c8e6c9' : '#ffccbc'
      }}>
        {isLaunched ? 
          'Watch the trailer and jump into the action!' :
          'Get a sneak peek at what\'s coming to BovisGL Network!'
        }
      </p>
      <div style={{
        position: 'relative',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        height: 0,
        maxWidth: '800px',
        margin: '0 auto',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: isLaunched ? 
          '0 8px 32px rgba(76, 175, 80, 0.3)' :
          '0 8px 32px rgba(255, 87, 34, 0.3)'
      }}>
        <iframe
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          src="https://www.youtube.com/embed/iTauUQDOyqw?rel=0&modestbranding=1&showinfo=0"
          title="BovisGL Network Official Trailer - Minecraft Anarchy Server Gameplay and Features"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p style={{ 
        fontSize: '0.9em', 
        color: isLaunched ? '#a5d6a7' : '#ff8a65', 
        marginTop: '15px',
        fontStyle: 'italic'
      }}>
        {isLaunched ? 
          '✨ The chaos is live! Join play.bovisgl.xyz and start your adventure!' :
          '🚀 Experience the chaos and excitement coming to our Anarchy server!'
        }
      </p>
    </div>
  );
}
