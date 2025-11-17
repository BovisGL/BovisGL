export default function ContactCard() {
  return (
    <section style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '1.8em', marginBottom: '20px' }}>📞 Contact Us</h2>
      <div style={{ display: 'grid', gap: '15px' }}>
        <div>
          <div style={{ color: '#bfc7d5', fontSize: '0.9em' }}>Website</div>
          <a href="https://bovisgl.xyz" target="_blank" rel="noopener noreferrer" style={{ color: '#4f8cff', textDecoration: 'none' }}>
            bovisgl.xyz
          </a>
        </div>
        <div>
          <div style={{ color: '#bfc7d5', fontSize: '0.9em' }}>Discord</div>
          <a href="https://discord.gg/nfbVQkz83V" target="_blank" rel="noopener noreferrer" style={{ color: '#4f8cff', textDecoration: 'none' }}>
            Join our Discord
          </a>
        </div>
      </div>
    </section>
  );
}
