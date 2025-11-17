import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './services/apiService';
import { checkAuthentication, handleAuthStateChange } from '../common/utils/auth';
import '../common/styles/index.css';
import './HomePage.css';

import AnarchyBanner from './components/AnarchyBanner';
import CountdownTiles from './components/CountdownTiles';
import TrailerPanel from './components/TrailerPanel';
import HowToJoinCard from './components/HowToJoinCard';
import ContactCard from './components/ContactCard';
import RulesPanel from './components/RulesPanel';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLaunched, setIsLaunched] = useState(false);
  const [serversOnline, setServersOnline] = useState({ hub: false, anarchy: false, proxy: false });
  const navigate = useNavigate();

  const checkAuth = useCallback(async () => {
    const isNowAuthenticated = await checkAuthentication(api);
    setIsAuthenticated(prev => {
      if (prev !== null) handleAuthStateChange(prev, isNowAuthenticated);
      return isNowAuthenticated;
    });
  }, []);

  const checkServerStatus = useCallback(async () => {
    try {
      const response = await api.get('/api/public/servers/status');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const newStatus = {
        hub: data.hub?.currentStatus === 'online',
        anarchy: data.anarchy?.currentStatus === 'online',
        proxy: data.proxy?.currentStatus === 'online'
      };
      setServersOnline(newStatus);
    } catch (error) {
      console.log('Server status check failed:', error);
      setServersOnline({ hub: false, anarchy: false, proxy: false });
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const initialCheckTimeout = setTimeout(checkAuth, 100);
    const authInterval = setInterval(checkAuth, 30000);
    const handleFocus = () => checkAuth();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(authInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkAuth]);

  useEffect(() => {
    const updateCountdown = () => {
      const launchDate = new Date('2025-07-29T18:00:00.000Z');
      const now = new Date();
      const timeLeft = launchDate.getTime() - now.getTime();
      if (timeLeft > 0) {
        setCountdown({
          days: Math.floor(timeLeft / (1000 * 60 * 60 * 24)),
          hours: Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((timeLeft % (1000 * 60)) / 1000)
        });
        setIsLaunched(false);
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsLaunched(true);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkServerStatus();
    const statusInterval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(statusInterval);
  }, [checkServerStatus]);

  return (
    <div className="home-page">
      <div className="floating-auth-btn">
        {isAuthenticated ? (
          <button className="button-primary" onClick={() => navigate('/admin')}>Admin Console</button>
        ) : (
          <button className="button-primary" onClick={() => navigate('/login')}>Admin Login</button>
        )}
      </div>

      <div className="container">
        <h1 style={{ textAlign: 'center', fontSize: '3em', marginBottom: '20px' }}>
          🚀 BovisGL Network - Coming Soon!
        </h1>

        <AnarchyBanner isLaunched={isLaunched} serversOnline={serversOnline} isMobile={isMobile} />

        {!isLaunched && <CountdownTiles countdown={countdown} />}

        <TrailerPanel isLaunched={isLaunched} />

        <div style={{
          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(33, 150, 243, 0.1))',
          border: '2px solid rgba(76, 175, 80, 0.3)',
          borderRadius: '15px',
          padding: '30px',
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '1.3em', marginBottom: 20, lineHeight: '1.6' }}>
            <strong>An epic crossplay Minecraft network supporting both Java & Bedrock editions!</strong>
          </p>
          <p style={{ fontSize: '1.1em', marginBottom: 16, lineHeight: '1.6' }}>
            Experience seamless crossplay between Java and Bedrock editions with <strong>Vivecraft VR support</strong> and multiple unique game modes all in one network. Join players from all platforms and enjoy enhanced gameplay features across our diverse server collection! We're always quick to update for new Minecraft features when possible.
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(156, 39, 176, 0.1))',
          border: '2px solid rgba(156, 39, 176, 0.3)',
          borderRadius: '15px',
          padding: '30px',
          marginBottom: '30px',
          textAlign: 'left'
        }}>
          <h2 style={{ 
            color: '#BA68C8', 
            marginBottom: '16px', 
            fontSize: '1.8em',
            textAlign: 'center',
            textShadow: '0 0 8px rgba(186, 104, 200, 0.3)'
          }}>
            ❓ Why BovisGL?
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.7', fontSize: '1.05em', color: '#e0e0e0' }}>
            <li style={{ marginBottom: 8 }}>• Do you think that standard griefing rules are boring and explosions make things better?</li>
            <li style={{ marginBottom: 8 }}>• Do you have a friend who only plays on a different edition than you?</li>
            <li style={{ marginBottom: 8 }}>• Do you want custom content in an SMP that you can't find anywhere else?</li>
            <li style={{ marginBottom: 8 }}>• Do you ever wish you could just chuck sand in the air for no reason; or drop an anvil on someone's head?</li>
            <li style={{ marginBottom: 8 }}>• Would strapping a fireball tank to a Happy Ghast make them actually useful?</li>
          </ul>
          <p style={{ marginTop: 14, fontWeight: 600, color: '#CE93D8', textAlign: 'center' }}>
            If your answer to any of these is YES; then this is the server for you.
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(114, 137, 218, 0.1), rgba(88, 101, 242, 0.1))',
          border: '2px solid rgba(114, 137, 218, 0.3)',
          borderRadius: '15px',
          padding: '25px',
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <h2 style={{ 
            color: '#7289DA', 
            marginBottom: '15px', 
            fontSize: '1.6em'
          }}>
            💬 Stay Updated!
          </h2>
          <p style={{ marginBottom: '20px', fontSize: '1.1em' }}>
            Join our Discord for development updates, launch announcements, and early access opportunities!
          </p>
          <a 
            href="https://discord.gg/nfbVQkz83V" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(45deg, #7289DA, #5865F2)',
              color: 'white',
              padding: '12px 30px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '1.1em',
              transition: 'transform 0.2s ease',
              boxShadow: '0 4px 15px rgba(114, 137, 218, 0.3)'
            }}
          >
            🎮 Join Discord
          </a>
        </div>

        <HowToJoinCard isMobile={isMobile} />

        <ContactCard />

        <RulesPanel />
      </div>
    </div>
  );
}
