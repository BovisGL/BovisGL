/**
 * PasskeyRegister Component
 * 
 * Registration page for invite-based passkey registration.
 * Validates invite token and registers new admin with passkey.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../../services/apiService';
import './PasskeyAuth.css';

export const PasskeyRegister = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const navigate = useNavigate();

  // Validate invite token on mount
  useEffect(() => {
    const validateInvite = async () => {
      if (!token) {
        setError('No invite token provided');
        setInviteValid(false);
        return;
      }

      try {
        const response = await api.get(
          `/api/public/passkey/invite-registration-options?inviteToken=${encodeURIComponent(token)}`
        );
        
        if (!response.ok) {
          throw new Error('Invalid or expired invite');
        }

        setInviteValid(true);
      } catch (err: any) {
        console.error('Invite validation error:', err);
        setError(err.message || 'Invalid invite token');
        setInviteValid(false);
      }
    };

    validateInvite();
  }, [token]);

  const handleRegister = async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      // Step 1: Get registration options
      const optionsResponse = await api.get(
        `/api/public/passkey/invite-registration-options?inviteToken=${encodeURIComponent(token)}`
      );
      
      if (!optionsResponse.ok) {
        throw new Error('Failed to start registration');
      }
      
      const optionsData = await optionsResponse.json();
      const options = optionsData.options || optionsData;

      // Step 2: Start WebAuthn registration
      const registration = await startRegistration({ optionsJSON: options });

      // Step 3: Verify registration
      const verifyResponse = await api.post('/api/public/passkey/invite-registration-verify', {
        attestation: registration,
        inviteToken: token
      });

      if (!verifyResponse.ok) {
        throw new Error('Registration failed');
      }

      const result = await verifyResponse.json();

      if (result.success) {
        // Store token and redirect
        localStorage.setItem('auth_token', result.token);
        navigate('/admin');
      } else {
        throw new Error(result.error || 'Registration failed');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  if (inviteValid === null) {
    return (
      <div className="passkey-auth-container">
        <div className="passkey-auth-card">
          <div className="passkey-auth-header">
            <h1>Validating Invite...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (inviteValid === false) {
    return (
      <div className="passkey-auth-container">
        <div className="passkey-auth-card">
          <div className="passkey-auth-header">
            <h1>Invalid Invite</h1>
            <p>This invite link is invalid or has expired</p>
          </div>
          <div className="passkey-error">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="passkey-auth-container">
      <div className="passkey-auth-card">
        <div className="passkey-auth-header">
          <h1>Create Admin Account</h1>
          <p>Register your passkey to access admin panel</p>
        </div>

        {error && (
          <div className="passkey-error">
            {error}
          </div>
        )}

        <button
          className="passkey-auth-button"
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <span className="passkey-loading">
              <span className="spinner"></span>
              Registering...
            </span>
          ) : (
            'Register Passkey'
          )}
        </button>

        <div className="passkey-footer">
          <p>
            Passkeys use your device's biometric authentication or PIN
            for secure, passwordless access.
          </p>
        </div>
      </div>
    </div>
  );
};
