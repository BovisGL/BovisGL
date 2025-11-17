# Authentication System Documentation

## Overview
BovisGL uses a **passkey-based authentication system** powered by WebAuthn (FIDO2) for secure, passwordless admin access. The system supports multiple registration flows, JWT token management, and CSRF protection.

## Technology Stack

### Core Libraries
- **[@simplewebauthn/browser](https://github.com/MasterKale/SimpleWebAuthn)** (v13.1.0) - WebAuthn client library
- **WebAuthn API** - Browser native passkey support (Windows Hello, Touch ID, security keys)
- **JWT Tokens** - JSON Web Tokens for session management
- **CSRF Tokens** - Cross-Site Request Forgery protection

### Browser Support
- **Chrome/Edge**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Opera**: 76+

**Note**: All browsers must support `window.PublicKeyCredential` API

---

## Authentication Flow

### 1. Login Flow (PasskeyAuth.tsx)

**Location**: `/frontend (old)/src/components/PasskeyAuth.tsx`

#### Step 1: Load Available Admins
```javascript
const loadAvailableAdmins = async () => {
  try {
    const response = await apiRequest('/api/public/passkey/available-admins', {
      method: 'GET'
    });
    
    if (response.success && response.admins?.length > 0) {
      setAvailableAdmins(response.admins);
    } else {
      setError('No admin accounts with passkeys found. Please contact your administrator.');
    }
  } catch (err) {
    setError('Failed to load authentication options. Please try again.');
  }
};
```

**API Response**:
```json
{
  "success": true,
  "admins": [
    { "name": "admin1", "id": "abc123" },
    { "name": "admin2", "id": "def456" }
  ]
}
```

#### Step 2: Authenticate with Passkey
```javascript
const handlePasskeyLogin = async () => {
  if (availableAdmins.length === 0) {
    setError('No admin accounts available for authentication');
    return;
  }

  try {
    setLoading('verifying');
    setError(null);
    
    // Try each available admin until one works
    for (const admin of availableAdmins) {
      try {
        // Get authentication options for this admin
        const options = await apiRequest('/api/public/passkey/login/options', {
          method: 'POST',
          body: { name: admin.name }
        });
        
        setLoading('processing');
        
        // Use SimpleWebAuthn to get assertion from authenticator
        const assertion = await startAuthentication({ optionsJSON: options });
        
        // Verify assertion with backend
        const response = await apiRequest('/api/public/passkey/login/verify', {
          method: 'POST',
          body: { assertion, name: admin.name }
        });
        
        if (response.success) {
          onLogin(response.token, response.admin);
          navigate('/admin');
          return;
        }
      } catch (adminError) {
        // Continue to next admin if this one fails
        continue;
      }
    }
    
    throw new Error('Authentication failed for all available accounts');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Authentication failed');
  } finally {
    setLoading('idle');
  }
};
```

**Authentication Challenge Flow**:
1. **Request Options**: Backend generates authentication challenge with `rpId`, `challenge`, `allowCredentials`
2. **User Interaction**: Browser prompts user for passkey (biometric, PIN, security key)
3. **Get Assertion**: Browser returns signed assertion with `authenticatorData`, `clientDataJSON`, `signature`
4. **Verify Assertion**: Backend verifies signature against stored public key
5. **Issue JWT**: Backend returns JWT token and admin info

---

## Registration Flows

### 1. Direct Passkey Registration (PasskeyAuth.tsx)

**Trigger**: URL parameter `?invite={token}`

```javascript
const handlePasskeyRegistration = async () => {
  if (!inviteToken) {
    setError('Invalid invite token');
    return;
  }

  try {
    setLoading('registering');
    setError(null);
    
    // Get registration options from backend
    const registrationOptionsResponse = await apiRequest(
      `/api/public/passkey/invite-registration-options?inviteToken=${encodeURIComponent(inviteToken)}`, 
      { method: 'GET' }
    );

    // Extract actual options (backend returns { options, admin })
    const options = registrationOptionsResponse?.options || registrationOptionsResponse;
    
    if (!options || !options.challenge) {
      throw new Error('Malformed server response: missing registration options');
    }

    // Preflight validation to catch base64 issues early
    validateWebAuthnOptions(options);

    setLoading('processing');
    
    // Use SimpleWebAuthn to create credential
    const registration = await startRegistration({ optionsJSON: options });
    
    // Verify registration with backend
    const verifyResponse = await apiRequest('/api/public/passkey/invite-registration-verify', {
      method: 'POST',
      body: { 
        attestation: registration, 
        inviteToken
      }
    });
    
    if (verifyResponse.success) {
      onLogin(verifyResponse.token, verifyResponse.admin);
      navigate('/admin');
    } else {
      throw new Error(verifyResponse.error || 'Registration failed');
    }
  } catch (err) {
    if (err?.message?.includes('atob')) {
      setError('Failed to decode WebAuthn options (base64 issue). Refresh and retry.');
    } else {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  } finally {
    setLoading('idle');
  }
};
```

### 2. Invite-based Registration (PasskeyInviteRegister.tsx)

**Location**: `/frontend (old)/src/components/PasskeyInviteRegister.tsx`

**Route**: `/admin/register/:token`

```javascript
const handleRegistration = async () => {
  if (!inviteToken) return;
  
  setLoading(true);
  setError('');
  
  try {
    // Get registration options (validates token and returns admin name)
    const response = await apiRequest(
      `/api/public/passkey/invite-registration-options?inviteToken=${encodeURIComponent(inviteToken)}`
    );
    
    if (response.error || response.success === false) {
      throw new Error(response.error || 'Invalid or expired invite.');
    }
    
    // Extract admin name from token validation response
    if (response.admin && response.admin.name) {
      setAdminName(response.admin.name);
    } else {
      throw new Error('Invalid token response - missing admin information');
    }
    
    setStep('register');
    
    // Preflight validation of base64url fields
    const opts = response.options;
    validateWebAuthnOptions(opts);

    // Start registration (may throw atob error if fields malformed)
    // Mitigation: if backend returned 1-char user.id (legacy), transform to base64url
    if (opts?.user?.id && opts.user.id.length < 3) {
      try {
        const fixed = btoa(opts.user.id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        console.warn('[PasskeyInviteRegister] Adjusted short user.id to base64url:', opts.user.id, '->', fixed);
        opts.user.id = fixed;
      } catch {}
    }
    
    const attestation = await startRegistration({ optionsJSON: opts });
    
    // Verify registration (backend will re-validate token for security)
    const verifyData = await apiRequest('/api/public/passkey/invite-registration-verify', {
      method: 'POST',
      body: { 
        attestation,
        inviteToken: inviteToken,
        deviceName: 'Web Browser'
      }
    });
    
    if (!verifyData.success) {
      throw new Error(verifyData.error || 'Registration failed');
    }
    
    // Store authentication info and redirect to admin panel
    if (verifyData.token && verifyData.admin) {
      localStorage.setItem('auth_token', verifyData.token);
      localStorage.setItem('userInfo', JSON.stringify({ displayName: verifyData.admin.name }));
      
      navigate('/admin');
      return;
    }
    
    setStep('success');
  } catch (e) {
    if (e?.message?.includes("atob")) {
      console.error('[PasskeyInviteRegister] atob failure details:', e);
      setError('WebAuthn options decode failed (base64 issue). Check console for details.');
    } else {
      setError(e.message);
    }
    setStep('error');
  } finally {
    setLoading(false);
  }
};
```

### 3. Legacy Registration Route (PasskeyRegistration.tsx)

**Location**: `/frontend (old)/src/components/PasskeyRegistration.tsx`

**Route**: `/register/:token`

**Note**: Similar to PasskeyInviteRegister but with different route and slightly different error handling. Uses same backend API.

---

## WebAuthn Options Validation

### Preflight Validation Helper
```javascript
const validateWebAuthnOptions = (opts: any) => {
  try {
    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    const problems: string[] = [];
    
    if (!opts) problems.push('options object missing');
    if (opts?.challenge && !base64urlPattern.test(opts.challenge)) {
      problems.push('challenge invalid chars');
    }
    if (opts?.user?.id && !base64urlPattern.test(opts.user.id)) {
      problems.push('user.id invalid chars');
    }
    
    if (Array.isArray(opts?.excludeCredentials)) {
      opts.excludeCredentials.forEach((c: any, i: number) => {
        if (c?.id && !base64urlPattern.test(c.id)) {
          problems.push(`excludeCredentials[${i}].id invalid chars`);
        }
      });
    }
    
    if (problems.length) {
      console.warn('[WebAuthn] Option preflight issues:', problems, opts);
    } else {
      console.log('[WebAuthn] Options preflight passed. challenge length:', opts?.challenge?.length);
    }
    
    // Deep validation: attempt decoding each base64url field
    const decodeIssues: string[] = [];
    const testDecode = (label: string, val?: string) => {
      if (!val) return;
      try {
        const b64 = val.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        atob(padded);
      } catch (e) {
        decodeIssues.push(`${label} failed base64 decode: ${(e as any).message}`);
      }
    };
    
    testDecode('challenge', opts?.challenge);
    testDecode('user.id', opts?.user?.id);
    
    if (Array.isArray(opts?.excludeCredentials)) {
      opts.excludeCredentials.forEach((c: any, i: number) => {
        if (typeof c?.id === 'string') testDecode(`excludeCredentials[${i}].id`, c.id);
      });
    }
    
    if (decodeIssues.length) {
      console.error('[WebAuthn] Base64 decode issues BEFORE startRegistration:', decodeIssues);
    } else {
      console.log('[WebAuthn] All base64url fields decoded successfully in preflight');
    }
  } catch (preErr) {
    console.warn('[WebAuthn] Validation preflight error (continuing):', preErr);
  }
};
```

**Purpose**: Catch malformed base64url fields before they cause cryptic "atob" errors inside SimpleWebAuthn library

---

## JWT Token Management

### Token Storage
```javascript
// After successful login/registration
localStorage.setItem('auth_token', token);
localStorage.setItem('userInfo', JSON.stringify({ displayName: admin.name }));
```

### Token Retrieval
```javascript
const token = localStorage.getItem('auth_token');
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
```

### Token Usage (apiService.ts)
```javascript
export const api = {
  get: async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    
    return fetch(url, {
      ...options,
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });
  },
  
  post: async (url: string, body: any, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    
    return fetch(url, {
      ...options,
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      body: JSON.stringify(body)
    });
  }
};
```

### Token Refresh (Placeholder)
```javascript
// TokenRefresher component in App.tsx (lines ~800-820)
const TokenRefresher = () => {
  useEffect(() => {
    const interval = setInterval(async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // TODO: Implement token refresh API call
        console.log('Refreshing token...');
        // await api.post('/api/locked/admin/refresh-token', {});
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  return null;
};
```

---

## CSRF Protection

### Token Fetch
```javascript
const fetchCsrfToken = async () => {
  try {
    const response = await api.get('/api/public/csrf-token');
    if (response.ok) {
      const data = await response.json();
      setCsrfToken(data.csrfToken);
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
  }
};
```

### Token Usage
```javascript
// On mutation requests (POST/PUT/DELETE)
const response = await api.post('/api/locked/servers/anarchy/start', {}, {
  headers: {
    'X-CSRF-Token': csrfToken
  }
});
```

### Token Validation (Backend)
Backend validates CSRF token on all mutation routes under `/api/locked/`

---

## Logout Flow

### Logout Handler
```javascript
const handleLogout = async () => {
  try {
    // Fetch CSRF token for logout request
    const csrfResponse = await api.get('/api/public/csrf-token');
    const { csrfToken } = await csrfResponse.json();
    
    // Call logout API
    const response = await api.post('/api/locked/admin/logout', {}, {
      headers: { 'X-CSRF-Token': csrfToken }
    });
    
    if (response.ok) {
      // Clear all auth data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('userInfo');
      
      // Clear cookies
      document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Redirect to home
      navigate('/');
    } else {
      console.error('Logout failed:', await response.text());
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
};
```

---

## Protected Routes

### ProtectedRoute Component
```javascript
const ProtectedRoute = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        navigate('/login');
        return;
      }
      
      try {
        const response = await api.get('/api/locked/admin/verify', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyAuth();
  }, [navigate]);
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return isAuthenticated ? children : null;
};
```

### Usage in Routes
```javascript
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<PasskeyAuth onLogin={handleLogin} />} />
  <Route path="/admin/register/:token" element={<PasskeyInviteRegister />} />
  
  <Route 
    path="/admin" 
    element={
      <ProtectedRoute>
        <AdminPanel />
      </ProtectedRoute>
    } 
  />
  
  <Route 
    path="/admin/players" 
    element={
      <ProtectedRoute>
        <PlayerManager />
      </ProtectedRoute>
    } 
  />
</Routes>
```

---

## API Endpoints

### Public Endpoints (No Auth)
- **GET** `/api/public/passkey/available-admins` - List admins with passkeys
- **POST** `/api/public/passkey/login/options` - Get authentication options
- **POST** `/api/public/passkey/login/verify` - Verify authentication assertion
- **GET** `/api/public/passkey/invite-registration-options?inviteToken={token}` - Get registration options
- **POST** `/api/public/passkey/invite-registration-verify` - Verify registration attestation
- **GET** `/api/public/csrf-token` - Get CSRF token

### Protected Endpoints (JWT Required)
- **GET** `/api/locked/admin/verify` - Verify JWT token
- **POST** `/api/locked/admin/logout` - Logout (CSRF required)
- **POST** `/api/locked/admin/invite` - Create invite (CSRF required)
- **POST** `/api/locked/servers/{id}/start` - Start server (CSRF required)
- **POST** `/api/locked/servers/{id}/stop` - Stop server (CSRF required)

---

## Styling

### PasskeyAuth.css

**Container**:
```css
.passkey-auth-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: #23272f;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  color: #e0e0e0;
}
```

**Title**:
```css
.passkey-auth-container h2 {
  margin-bottom: 1.5rem;
  color: #f3f3f3;
  text-align: center;
  font-weight: 700;
  letter-spacing: 0.5px;
}
```

**Input Fields**:
```css
.form-group input {
  padding: 0.75rem;
  background: #181a20;
  color: #e0e0e0;
  border: 1px solid #444a57;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #4f8cff;
  box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.25);
}
```

**Buttons**:
```css
.primary-auth-btn {
  background: linear-gradient(90deg, #4f8cff 0%, #2356a8 100%);
  color: #fff;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.primary-auth-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #3d7ae6 0%, #1e4a95 100%);
}

.primary-auth-btn:disabled {
  background: #3a4252;
  color: #888;
  cursor: not-allowed;
  border: 1px solid #444a57;
}
```

**Loading State**:
```css
button.loading {
  position: relative;
  color: transparent;
}

button.loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  top: 50%;
  left: 50%;
  margin: -10px 0 0 -10px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: button-loading-spinner 0.8s linear infinite;
}

@keyframes button-loading-spinner {
  from { transform: rotate(0turn); }
  to { transform: rotate(1turn); }
}
```

**Error Message**:
```css
.error-message {
  color: #ff5c5c;
  background-color: #2d1b1e;
  border: 1px solid #5c2829;
  padding: 0.75rem;
  border-radius: 4px;
  margin: 0.5rem 0;
  font-size: 0.9rem;
  font-weight: 500;
}
```

---

## Loading States

### State Types
```typescript
type LoadingState = 'idle' | 'verifying' | 'registering' | 'processing';
```

**Usage**:
- **'idle'**: No action in progress
- **'verifying'**: Fetching authentication options
- **'registering'**: Getting registration options
- **'processing'**: Waiting for browser WebAuthn prompt or backend verification

### UI Updates
```javascript
{loading === 'verifying' ? 'Verifying...' : 
 loading === 'processing' ? 'Authenticating...' : 
 loading === 'registering' ? 'Setting up...' :
 '🔐 Sign In with Passkey'}
```

---

## Error Handling

### Error Types
1. **Browser Support**: "WebAuthn is not supported in this browser"
2. **No Admins**: "No admin accounts with passkeys found"
3. **Network Errors**: "Failed to load authentication options"
4. **Auth Failures**: "Authentication failed for all available accounts"
5. **Registration Errors**: "Invalid or expired invite"
6. **Base64 Errors**: "Failed to decode WebAuthn options (base64 issue)"

### Error Display
```javascript
{error && <div className="error-message">{error}</div>}
```

### Error Auto-clear
- Errors persist until user performs another action
- Loading states reset errors: `setError(null)`

---

## Security Features

### Passkey Advantages
1. **Phishing Resistant**: Passkeys tied to domain, can't be used on fake sites
2. **No Passwords**: No password storage, no password leaks
3. **Biometric Auth**: Face ID, Touch ID, Windows Hello
4. **Hardware Tokens**: Supports FIDO2 security keys (YubiKey, etc.)
5. **Public Key Crypto**: Private key never leaves device

### JWT Security
1. **Signed Tokens**: Backend verifies signature on each request
2. **Short Expiry**: Tokens expire after 24 hours (recommended)
3. **Refresh Rotation**: New tokens issued on refresh (planned)
4. **Secure Storage**: HttpOnly cookies + localStorage (defense in depth)

### CSRF Protection
1. **Token Required**: All mutations require CSRF token
2. **Double Submit**: Cookie + header verification
3. **Origin Validation**: Backend checks request origin
4. **Expiry**: CSRF tokens expire after short time (5 minutes recommended)

---

## Common Issues & Solutions

### Issue 1: "atob" Error
**Symptom**: `Failed to execute 'atob' on 'Window'`

**Causes**:
- Malformed base64url in `challenge` or `user.id` fields
- Backend returning wrong wrapper (full response instead of just options)
- Non-ASCII characters in user.id

**Solution**:
```javascript
// Preflight validation catches these before SimpleWebAuthn
validateWebAuthnOptions(opts);

// Fix short user.id (legacy issue)
if (opts?.user?.id && opts.user.id.length < 3) {
  const fixed = btoa(opts.user.id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  opts.user.id = fixed;
}
```

### Issue 2: "User Cancelled" Error
**Symptom**: Registration/login fails with user cancellation

**Causes**:
- User dismissed browser prompt
- Timeout waiting for user interaction
- Wrong authenticator selected

**Solution**: Retry with clear instructions

### Issue 3: "Invalid Token" on Registration
**Symptom**: Registration fails with "Invalid or expired invite"

**Causes**:
- Invite token expired
- Token already used
- Token revoked by admin

**Solution**: Request new invite from admin

---

## Future Enhancements

### Planned Features
1. **Multi-device Passkeys**: Sync passkeys across user's devices
2. **Backup Codes**: One-time codes for account recovery
3. **Session Management**: View/revoke active sessions
4. **2FA Option**: Optional TOTP as second factor
5. **Audit Logging**: Track all login/logout events

### UI Improvements
1. **Passkey Nickname**: Let users name their passkeys
2. **Device Management**: View/delete registered passkeys
3. **QR Code Login**: Scan QR on mobile to login on desktop
4. **Biometric Icon**: Show Face ID/Touch ID icon based on device
