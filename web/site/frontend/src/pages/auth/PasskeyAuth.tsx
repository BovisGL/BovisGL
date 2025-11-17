/**
 * PasskeyAuth Component
 * 
 * Main login page with WebAuthn passkey authentication.
 * Matches old styling: #23272f background, #4f8cff primary blue.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { api } from '../../services/apiService';
import './PasskeyAuth.css';

export const PasskeyAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Get available admins
      const adminsResponse = await api.get('/api/public/passkey/available-admins');
      
      if (!adminsResponse.ok) {
        throw new Error('Failed to load available admins');
      }
      
      const adminsData = await adminsResponse.json();
      
      if (!adminsData.success || !adminsData.admins?.length) {
        throw new Error('No admin accounts available');
      }

      // Step 2: Try each available admin
      for (const admin of adminsData.admins) {
        try {
          // Get authentication options for this admin
          const optionsResponse = await api.post('/api/public/passkey/login/options', {
            name: admin.name
          });
          
          if (!optionsResponse.ok) continue;
          
          const options = await optionsResponse.json();

          // Step 3: Start WebAuthn authentication
          const assertion = await startAuthentication({ optionsJSON: options });

          // Step 4: Verify authentication
          const verifyResponse = await api.post('/api/public/passkey/login/verify', {
            assertion,
            name: admin.name
          });

          if (!verifyResponse.ok) continue;

          const result = await verifyResponse.json();

          if (result.success) {
            // Store token and redirect
            localStorage.setItem('auth_token', result.token);
            navigate('/admin');
            return;
          }
        } catch (adminError) {
          // Continue to next admin if this one fails
          continue;
        }
      }
      
      throw new Error('Authentication failed for all available accounts');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="passkey-auth-container">
      <div className="passkey-auth-card">
        <div className="passkey-auth-header">
          <h1>BovisGL Admin</h1>
          <p>Sign in with your passkey</p>
        </div>

        {error && (
          <div className="passkey-error">
            {error}
          </div>
        )}

        <button
          className="passkey-auth-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="passkey-loading">
              <span className="spinner"></span>
              Authenticating...
            </span>
          ) : (
            'Sign In with Passkey'
          )}
        </button>

        <div className="passkey-footer">
          <p>
            Have an invite code?{' '}
            <Link to="/register/invite">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
