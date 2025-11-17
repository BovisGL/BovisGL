# Session Management System

## Overview

The application now includes automatic session management with:
1. **Token Expiry Detection** - Redirects to login if auth token expires
2. **Idle Timeout** - Logs user out after 30 minutes of inactivity
3. **Automatic Websocket Disconnection** - Closes all websocket connections on session end

## How It Works

### Components

1. **`SessionManager` Component** (`src/components/SessionManager.tsx`)
   - Wraps the entire app
   - Initializes session monitoring
   - Handles websocket cleanup on session end

2. **`useSessionManagement` Hook** (`src/hooks/useSessionManagement.ts`)
   - Monitors user activity (keyboard, mouse, touch, scroll)
   - Checks token expiry every second
   - Detects idle timeout (30 minutes)
   - Triggers disconnect callback when session expires

3. **`SessionExpiredPage` Component** (`src/pages/auth/SessionExpiredPage.tsx`)
   - Shows when token expires or idle timeout occurs
   - Displays reason (token expiry vs idle)
   - Provides "Refresh Page" button to redirect to login
   - Shows status: "All websocket connections have been disconnected"

### Activity Tracking

The hook automatically tracks these user activities:
- Mouse movement/clicks (`mousedown`)
- Keyboard input (`keydown`)
- Page scrolling (`scroll`)
- Touch input (`touchstart`)
- General clicks (`click`)

Any of these activities resets the idle timer.

### Timeout Behavior

**Token Expiry (Immediate)**
- Checked every second
- If token becomes invalid (401 response), immediately:
  - Closes all websockets
  - Clears session storage
  - Redirects to `/session-expired?reason=token`
  - Shows login page

**Idle Timeout (30 minutes)**
- After 30 minutes of NO user activity
- Immediately:
  - Closes all websockets
  - Clears session storage
  - Redirects to `/session-expired?reason=idle`
  - Shows "Session Idle" message

### Integration Points

1. **App.tsx** - Added `<SessionManager />` and session-expired route
2. **ProtectedRoute** - Already requires authentication
3. **AdminPanel** & **PlayerManagerPage** - Work with session management transparently

### Websocket Cleanup

The system closes websockets by:
1. Looking for websockets stored in `window.__websockets`
2. Calling `.close()` on each connection
3. Triggering localStorage event to signal other components

## Usage

No special setup required! The system works automatically:

```tsx
// In App.tsx, SessionManager is already added:
<SessionManager />
```

The hook runs in the background and:
- Monitors all user activity
- Checks token validity
- Redirects when session expires
- Cleans up all connections

## Configuration

To adjust timeouts, edit `src/hooks/useSessionManagement.ts`:

```typescript
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 1000; // Check every second
```

## User Experience

### Scenario 1: Token Expires While Active
1. User gets redirected to session expired page
2. Shows "Session Expired"
3. User clicks "Refresh Page" → redirected to login

### Scenario 2: User Idle for 30 Minutes
1. No activity detected for 30 minutes
2. User gets redirected to session expired page
3. Shows "Session Idle" with message about inactivity
4. User clicks "Refresh Page" → redirected to login

### Scenario 3: User Active
- Activity keeps resetting idle timer
- Token validity is checked continuously
- Session remains active

## Logging

The session management logs to browser console:
- Token expiry checks
- Idle timeout detection
- Websocket cleanup success/failures

## Security Benefits

1. **Automatic logout** - Prevents unattended sessions
2. **Websocket cleanup** - Stops data leaks from abandoned connections
3. **Server-side validation** - Token expiry verified on server
4. **Activity-based** - Legitimate user activity extends session
5. **Clear feedback** - Users know why they were logged out

## Troubleshooting

### Session expires immediately after login
- Check if token expiry time is correct on server
- Verify `/api/locked/auth/verify` endpoint works
- Check browser console for network errors

### Idle timeout not working
- Check if activity events are firing (enable in DevTools)
- Verify `IDLE_TIMEOUT_MS` is set correctly
- Check browser privacy settings for event blockers

### Websockets not closing
- Verify websockets are stored in `window.__websockets`
- Check websocket code implements `.close()` method
- Check browser console for closure errors

## Files Modified/Created

- ✅ `src/hooks/useSessionManagement.ts` (NEW)
- ✅ `src/components/SessionManager.tsx` (NEW)
- ✅ `src/pages/auth/SessionExpiredPage.tsx` (NEW)
- ✅ `src/App.tsx` (MODIFIED - added SessionManager and route)
