import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts
} from '@simplewebauthn/server';
import crypto from 'crypto';
import { inviteOps, adminOps, credentialOps, challengeOps } from './database.js';
import { generateSecureToken } from './jwt.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import centralized admin logging
import { logAdminAction } from '../../logging/index.js';

const RP_NAME = 'BovisGL Admin';
const RP_ID = process.env.NODE_ENV === 'production' ? 'bovisgl.xyz' : 'localhost';
const EXPECTED_ORIGIN = process.env.NODE_ENV === 'production' ? 
  ['https://bovisgl.xyz', 'https://bovisgl.pages.dev', 'https://fca1678d.bovisgl.pages.dev'] : 
  'http://localhost:3000';

export const passkeyService = {
  // Get registration options for invite-based registration
  async getInviteRegistrationOptions(inviteToken: string, sessionId: string) {
    console.log('[DEBUG] Getting registration options for invite:', inviteToken);
    
    // Clean up expired invites first
    await inviteOps.deleteExpired();
    
    // Find and validate invite
    const invite = await inviteOps.findByToken(inviteToken);
    console.log('[DEBUG] Found invite:', invite);
    if (!invite) {
      throw new Error('Invalid or expired invite token');
    }

    // Check if admin already exists, if not create them
    let admin = await adminOps.findByName(invite.name);
    if (!admin) {
      admin = await adminOps.create(invite.name);
    }

    // Get existing credentials to exclude from registration
    const existingCredentials = await credentialOps.findByAdminId(admin.id);
    if (existingCredentials.length) {
      try {
        console.log('[passkeyService.getInviteRegistrationOptions] Existing credential IDs (raw):', existingCredentials.map((c: any) => c.credential_id));
      } catch {}
    }

    // Generate registration options
    const validExcludeCredentials = existingCredentials.map((cred: any) => {
      try {
        // Ensure the credential ID is properly base64url encoded
        let credentialIdBuffer;
        if (cred.credential_id.includes('|') || cred.credential_id.includes('=')) {
          // Handle malformed credential IDs by cleaning them
          const cleanId = cred.credential_id.replace(/[|=]/g, '');
          credentialIdBuffer = Buffer.from(cleanId, 'base64url');
        } else {
          credentialIdBuffer = Buffer.from(cred.credential_id, 'base64url');
        }
        // Quick validation: re-encode round trip
        const roundTrip = Buffer.from(credentialIdBuffer).toString('base64url');
        if (roundTrip !== cred.credential_id.replace(/[|=]/g,'')) {
          console.warn('[passkeyService.getInviteRegistrationOptions] Credential ID round-trip mismatch (sanitized). original:', cred.credential_id, 'roundTrip:', roundTrip);
        }
        
        return {
          id: credentialIdBuffer,
          type: 'public-key' as const,
        };
      } catch (error) {
        console.warn(`[WARNING] Skipping malformed credential ID: ${cred.credential_id}`, error);
        return null;
      }
    }).filter(Boolean) as Array<{ id: Buffer; type: 'public-key' }>;

    // IMPORTANT: userID must be a stable, opaque, base64url string representing binary bytes.
    // A single character like '1' is NOT valid base64 (after padding attempt it fails). Encode the admin.id bytes.
    const userIdB64 = Buffer.from(String(admin.id), 'utf8').toString('base64url'); // e.g. admin.id=1 -> 'MQ'
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userIdB64,
      userName: invite.name,
      userDisplayName: invite.name,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
        requireResidentKey: false,
        residentKey: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
      timeout: 90000,
      excludeCredentials: validExcludeCredentials,
    });

    // Backend validation to help diagnose atob issues on client
    try {
      const b64urlPattern = /^[A-Za-z0-9_-]+$/;
      const problems: string[] = [];
      if (!b64urlPattern.test(options.challenge)) problems.push('challenge invalid chars');
      if (options.user && !b64urlPattern.test(options.user.id)) problems.push('user.id invalid chars');
      if (Array.isArray(options.excludeCredentials)) {
        options.excludeCredentials.forEach((c: any, i: number) => {
          // c.id is a Buffer here; ensure when stringified it remains b64url
          if (Buffer.isBuffer(c.id)) {
            const idStr = c.id.toString('base64url');
            if (!b64urlPattern.test(idStr)) problems.push(`excludeCredentials[${i}].id invalid after base64url`);
          }
        });
      }
      if (problems.length) {
        console.warn('[passkeyService.getInviteRegistrationOptions] Option validation issues:', problems);
      } else {
        console.log('[passkeyService.getInviteRegistrationOptions] Validation passed. userID (encoded):', userIdB64, 'raw admin.id:', admin.id);
      }
    } catch (vErr) {
      console.warn('[passkeyService.getInviteRegistrationOptions] Validation check failed (non-fatal):', vErr);
    }

    // Store challenge
    await challengeOps.store(sessionId, options.challenge, admin.id);

    return { options, admin };
  },

  // Verify registration response
  async verifyRegistration(sessionId: string, registrationResponse: any, deviceName?: string, clientIp?: string, inviteToken?: string) {
    console.log('[DEBUG] Verifying registration for session:', sessionId);

    // SECURITY: Invite token is REQUIRED for registration - refuse if not provided
    if (!inviteToken) {
      throw new Error('Invite token is required for registration');
    }

    console.log('[DEBUG] Re-validating invite token in registration:', inviteToken);
    
    // Clean up expired invites first
    await inviteOps.deleteExpired();
    
    // Re-validate the token
    const invite = await inviteOps.findByToken(inviteToken);
    if (!invite) {
      throw new Error('Invalid or expired invite token during registration');
    }
    console.log('[DEBUG] Token re-validation successful');

    // Get stored challenge
    const challengeData = await challengeOps.get(sessionId);
    if (!challengeData) {
      throw new Error('No registration challenge found');
    }

    const admin = await adminOps.findById(challengeData.admin_id);
    if (!admin) {
      throw new Error('Admin not found');
    }

    // Verify registration
    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false, // Allow passkeys without user verification
    } as VerifyRegistrationResponseOpts);

    if (!verification.verified || !verification.registrationInfo) {
      // Log failed registration
      if (clientIp) {
        await logAdminAction(
          admin.name,
          'PASSKEY_REGISTER',
          false,
          clientIp,
          'Passkey registration verification failed'
        );
      }
      throw new Error('Registration verification failed');
    }

    // Store credential
    const credentialID = Buffer.from(verification.registrationInfo.credentialID).toString('base64url');
    const publicKey = Buffer.from(verification.registrationInfo.credentialPublicKey).toString('base64');

    await credentialOps.create(admin.id, credentialID, publicKey, deviceName);

    // Mark invite as used (token is required, so this will always execute)
    await inviteOps.markAsUsed(inviteToken);
    console.log('[DEBUG] Marked invite as used:', inviteToken);

    // Generate JWT token
    const { token, expiryTime } = generateSecureToken(
      admin.name,
      admin.name,
      admin
    );

    // Clean up challenge
    await challengeOps.delete(sessionId);

    // Log successful registration
    if (clientIp) {
      await logAdminAction(
        admin.name,
        'PASSKEY_REGISTER',
        true,
        clientIp,
        `Registered new passkey device: ${deviceName || 'Unnamed Device'}`
      );
    }

    return { success: true, token, expiryTime, admin };
  },

  // Get authentication options for login
  async getAuthenticationOptions(name: string, sessionId: string) {
    console.log('[DEBUG] Getting authentication options for:', name);

    // Find admin
    const admin = await adminOps.findByName(name);
    if (!admin) {
      throw new Error('Admin not found');
    }

    // Get admin's credentials
    const credentials = await credentialOps.findByAdminId(admin.id);
    if (credentials.length === 0) {
      throw new Error('No passkeys registered for this admin');
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      allowCredentials: credentials.map((cred: any) => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key' as const,
        transports: ['usb', 'nfc', 'ble', 'hybrid', 'internal'],
      })),
      userVerification: 'preferred',
      rpID: RP_ID,
      timeout: 90000,
    });

    // Store challenge
    await challengeOps.store(sessionId, options.challenge, admin.id);

    return options;
  },

  // Verify authentication response
  async verifyAuthentication(sessionId: string, authenticationResponse: any, clientIp?: string) {
    console.log('[DEBUG] Verifying authentication for session:', sessionId);

    // Get stored challenge
    const challengeData = await challengeOps.get(sessionId);
    if (!challengeData) {
      // Log failed authentication attempt
      if (clientIp) {
        await logAdminAction(
          'Unknown',
          'LOGIN_ATTEMPT',
          false,
          clientIp,
          'No authentication challenge found'
        );
      }
      throw new Error('No authentication challenge found');
    }

    const admin = await adminOps.findById(challengeData.admin_id);
    if (!admin) {
      // Log failed authentication attempt
      if (clientIp) {
        await logAdminAction(
          'Unknown',
          'LOGIN_ATTEMPT',
          false,
          clientIp,
          'Admin not found for authentication challenge'
        );
      }
      throw new Error('Admin not found');
    }

    // Find the credential being used
    const credentialID = Buffer.from(authenticationResponse.id, 'base64url').toString('base64url');
    const credential = await credentialOps.findByCredentialId(credentialID);
    if (!credential) {
      // Log failed authentication attempt
      if (clientIp) {
        await logAdminAction(
          admin.name,
          'LOGIN_ATTEMPT',
          false,
          clientIp,
          'Credential not found'
        );
      }
      throw new Error('Credential not found');
    }

    // Verify authentication
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false, // Allow passkeys without user verification
      authenticator: {
        credentialID: Buffer.from(credential.credential_id, 'base64url'),
        credentialPublicKey: Buffer.from(credential.public_key, 'base64'),
        counter: credential.counter,
      },
    } as VerifyAuthenticationResponseOpts);

    if (!verification.verified) {
      // Log failed authentication attempt
      if (clientIp) {
        await logAdminAction(
          admin.name,
          'LOGIN_ATTEMPT',
          false,
          clientIp,
          'Authentication verification failed'
        );
      }
      throw new Error('Authentication verification failed');
    }

    // Update counter and last used
    await credentialOps.updateCounter(
      credential.credential_id,
      verification.authenticationInfo.newCounter
    );

    // Update admin last login
    await adminOps.updateLastLogin(admin.id);

    // Generate JWT token
    const { token, expiryTime } = generateSecureToken(
      admin.name,
      admin.name,
      admin
    );

    // Clean up challenge
    await challengeOps.delete(sessionId);

    // Log successful authentication
    if (clientIp) {
      await logAdminAction(
        admin.name,
        'LOGIN_SUCCESS',
        true,
        clientIp,
        'Successful passkey authentication'
      );
    }

    return { success: true, token, expiryTime, admin };
  },

  // Get cross-platform authentication options (for USB keys, etc.)
  async getCrossPlatformAuthenticationOptions(name: string, sessionId: string) {
    console.log('[DEBUG] Getting cross-platform authentication options for:', name);

    // Find admin
    const admin = await adminOps.findByName(name);
    if (!admin) {
      throw new Error('Admin not found');
    }

    // Get admin's credentials
    const credentials = await credentialOps.findByAdminId(admin.id);
    if (credentials.length === 0) {
      throw new Error('No passkeys registered for this admin');
    }

    // Generate authentication options for cross-platform authenticators
    const options = await generateAuthenticationOptions({
      allowCredentials: credentials.map((cred: any) => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key' as const,
        transports: ['usb', 'nfc', 'ble', 'hybrid'], // Cross-platform only
      })),
      userVerification: 'preferred',
      rpID: RP_ID,
      timeout: 120000, // Longer timeout for cross-platform
    });

    // Store challenge
    await challengeOps.store(sessionId, options.challenge, admin.id);

    return options;
  },

  // Force sign out all users (emergency function)
  async forceSignoutAll() {
    console.log('[DEBUG] Force signing out all users - removing credentials only, preserving admin accounts');
    
    // Delete all credentials (signs everyone out but preserves admin accounts)
    const db = await (await import('./database.js')).getDatabase();
    await db.run('DELETE FROM passkey_credentials');
    
    // Clean up challenges
    await challengeOps.cleanup();
    
    // Admin accounts preserved - they can re-register passkeys

    return { success: true, message: 'All users signed out (passkey credentials removed, admin accounts preserved)' };
  },

  // Get admin devices (credentials)
  async getAdminDevices(adminId: number) {
    const credentials = await credentialOps.findByAdminId(adminId);
    return credentials.map((cred: any) => ({
      id: cred.id,
      deviceName: cred.device_name || 'Unknown Device',
      createdAt: cred.created_at,
      lastUsed: cred.last_used,
    }));
  },

  // Get available admins with passkeys (for simplified login)
  async getAvailableAdmins() {
    try {
      // Get all admins who have at least one passkey credential
      const adminsWithCredentials = await adminOps.findAdminsWithCredentials();
      return adminsWithCredentials;
    } catch (error: any) {
      // Log the original error so server logs contain the root cause
      console.error('Error getting available admins (root):', error);

      // In production, hide internal details from callers; in development rethrow the original error
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to get available admins');
      }

      // Re-throw original error in non-production so the route returns helpful message for debugging
      throw error;
    }
  }
}; 