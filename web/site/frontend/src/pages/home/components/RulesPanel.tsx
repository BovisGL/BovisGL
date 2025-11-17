const rules = [
  { 
    num: 'I', 
    title: 'Respect & Courtesy', 
    text: '• Treat all players and staff with kindness and fairness.\n• Play in a way you\'d appreciate from others.'
  },
  { 
    num: 'II', 
    title: 'Chat Conduct', 
    text: '• No spamming, advertising, or disruptive messages.\n• Zero tolerance for hate speech or slurs (racist, sexist, homophobic, etc.).\n• Keep language clean—no profanity or adult content.'
  },
  { 
    num: 'III', 
    title: 'In-Game Builds & Content', 
    text: '• All builds, skins, signs, and other creations must be suitable for all ages.\n• NSFW, pornographic, or excessively violent content is forbidden.'
  },
  { 
    num: 'IV', 
    title: 'Hacks, Mods & Exploits', 
    text: '• Absolutely no hacked clients, cheats, automation tools, or exploits on any server (including Anarchy).\n• Any modification that grants an unfair advantage or alters core gameplay—e.g., auto-clickers, X-ray, noclip—will lead to immediate penalties.\n• If you\'re unsure whether a mod is allowed, ask staff before using it.'
  },
  { 
    num: 'V', 
    title: 'Usernames & Visuals', 
    text: '• Usernames, avatars, and custom graphics must be non-offensive and family-friendly.\n• Staff reserves the right to force a name change or revoke any asset at their discretion.'
  },
  { 
    num: 'VI', 
    title: 'Staff & Enforcement', 
    text: '• Respect all staff members. Follow their instructions promptly.\n• Rudeness, arguing, or ignoring staff warnings will escalate consequences.'
  }
];

export default function RulesPanel() {
  return (
    <section style={{ marginTop: '40px' }}>
      <h2 style={{ fontSize: '1.8em', marginBottom: '20px' }}>📋 Minecraft Server Rules</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rules.map(r => (
          <li key={r.num} style={{ 
            display: 'flex', 
            gap: '15px', 
            marginBottom: '20px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '15px',
            borderRadius: '8px'
          }}>
            <div style={{ 
              fontWeight: 800, 
              fontSize: '1.5em',
              minWidth: '40px',
              color: '#4f8cff'
            }}>{r.num}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: '8px' }}>{r.title}</div>
              <div style={{ 
                color: '#bfc7d5', 
                fontSize: '0.95em', 
                lineHeight: '1.6',
                whiteSpace: 'pre-line'
              }}>{r.text}</div>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ 
        marginTop: '25px',
        padding: '20px', 
        background: 'rgba(255, 193, 7, 0.1)', 
        borderRadius: '10px', 
        border: '1px solid rgba(255, 193, 7, 0.3)',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '1.1em', marginBottom: '10px', color: '#FFC107' }}>
          <strong>🌟 Remember: We're building a fun, welcoming community!</strong>
        </p>
        <p style={{ opacity: 0.9, fontSize: '0.95em' }}>
          These rules help ensure everyone can enjoy their time on BovisGL Network. When in doubt, treat others with respect and you'll be just fine!
        </p>
      </div>
    </section>
  );
}
