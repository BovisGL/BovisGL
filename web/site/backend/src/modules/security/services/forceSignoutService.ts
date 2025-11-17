import crypto from 'crypto';
import { getDatabase } from '../../auth/services/database.js';
import { logSystemEvent, logSecurityViolation } from './securityLogger.js';

export interface ForceSignoutResult {
  success: boolean;
  message: string;
  details: {
    passkeyCredentialsRemoved: number;
    adminInvitesCleared: number;
    adminsRemoved: number;
    securityChallengesCleared: number;
    newInviteCreated?: {
      inviteCode: string;
      inviteUrl: string;
      expiresAt: string;
      displayName: string;
    };
  };
  timestamp: string;
}

export interface ForceSignoutOptions {
  createNewAdminInvite: boolean;
  adminDisplayName?: string;
}

export class ForceSignoutService {
  private static instance: ForceSignoutService;

  private constructor() {}

  public static getInstance(): ForceSignoutService {
    if (!ForceSignoutService.instance) {
      ForceSignoutService.instance = new ForceSignoutService();
    }
    return ForceSignoutService.instance;
  }

  public async executeForceSignout(
    initiatorId: string, 
    initiatorName: string,
    options: ForceSignoutOptions
  ): Promise<ForceSignoutResult> {
    try {
      const db = await getDatabase();
      
      await logSystemEvent('FORCE_SIGNOUT_INITIATED', 'CRITICAL', 
        `Force signout initiated by ${initiatorName}. Create new invite: ${options.createNewAdminInvite}`, 
        initiatorId);

      const result: ForceSignoutResult = {
        success: false,
        message: '',
        details: {
          passkeyCredentialsRemoved: 0,
          adminInvitesCleared: 0,
          adminsRemoved: 0,
          securityChallengesCleared: 0
        },
        timestamp: new Date().toISOString()
      };

      let newInviteCode: string | null = null;

      // 1. Create new admin invite FIRST if requested (before clearing everything)
      if (options.createNewAdminInvite) {
        try {
          // Generate unique invite code
          let inviteCode: string;
          let isUnique = false;
          
          while (!isUnique) {
            inviteCode = crypto.randomBytes(32).toString('hex');
            const existing = await db.get(`
              SELECT invite_code FROM admin_invites WHERE invite_code = ?
            `, [inviteCode]);
            
            if (!existing) {
              isUnique = true;
              newInviteCode = inviteCode;
            }
          }

          // Calculate expiration (48 hours from now for emergency access)
          const expiresAt = new Date(Date.now() + (48 * 60 * 60 * 1000)).toISOString();
          
          // Use provided admin display name or default to initiator
          const createInviteFor = options.adminDisplayName || initiatorName;
          
          // Extract first and last name from display name
          const nameParts = createInviteFor.trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Insert emergency admin invite
          await db.run(`
            INSERT INTO admin_invites (invite_code, first_name, last_name, display_name, expires_at)
            VALUES (?, ?, ?, ?, ?)
          `, [newInviteCode, firstName, lastName, createInviteFor, expiresAt]);

          const inviteUrl = `https://bovisgl.xyz/admin/passkey/invite/${newInviteCode}`;

          if (newInviteCode) {
            result.details.newInviteCreated = {
              inviteCode: newInviteCode,
              inviteUrl,
              expiresAt,
              displayName: createInviteFor
            };
          }

          await logSystemEvent('EMERGENCY_INVITE_CREATED', 'HIGH', 
            `Emergency admin invite created for ${createInviteFor} during force signout`, 
            initiatorId);

        } catch (error: any) {
          await logSystemEvent('EMERGENCY_INVITE_FAILED', 'CRITICAL', 
            `Failed to create emergency admin invite: ${error.message}`, 
            initiatorId);
          
          return {
            success: false,
            message: `Failed to create emergency admin invite: ${error.message}`,
            details: {
              passkeyCredentialsRemoved: 0,
              adminInvitesCleared: 0,
              adminsRemoved: 0,
              securityChallengesCleared: 0
            },
            timestamp: new Date().toISOString()
          };
        }
      }

      // 2. Remove all passkey credentials (this signs everyone out but preserves admin accounts)
      const passkeyResult = await db.run(`DELETE FROM passkey_credentials`);
      result.details.passkeyCredentialsRemoved = passkeyResult.changes || 0;

      // 3. DO NOT delete admin accounts - just remove their credentials (they can re-register passkeys)
          // Admin accounts are preserved during force signout
    result.details.adminsRemoved = 0;

      // 4. Clear all authentication challenges
      const challengesResult = await db.run(`DELETE FROM auth_challenges`);
      result.details.securityChallengesCleared = challengesResult.changes || 0;

      // 5. Clear all admin invites EXCEPT the new one we just created
      let invitesClearQuery = `DELETE FROM admin_invites`;
      let invitesClearParams: any[] = [];
      
      if (newInviteCode) {
        invitesClearQuery += ` WHERE invite_code != ?`;
        invitesClearParams.push(newInviteCode);
      }

      const invitesResult = await db.run(invitesClearQuery, invitesClearParams);
      result.details.adminInvitesCleared = invitesResult.changes || 0;

      // 6. Log comprehensive security event
      await logSecurityViolation('FORCE_SIGNOUT_COMPLETE', 'CRITICAL', 
        `Force signout completed: ${result.details.passkeyCredentialsRemoved} credentials removed, ${result.details.adminsRemoved} admins removed, ${result.details.adminInvitesCleared} invites cleared${options.createNewAdminInvite ? ', emergency invite created' : ''}`,
        undefined, undefined);

      result.success = true;
      result.message = options.createNewAdminInvite 
        ? '🎉 Force signout complete with emergency admin invite created'
        : '🎉 Force signout complete - all authentication data cleared';

      return result;

    } catch (error: any) {
      await logSystemEvent('FORCE_SIGNOUT_FAILED', 'CRITICAL', 
        `Force signout failed: ${error.message}`, 
        initiatorId);

      return {
        success: false,
        message: `Force signout failed: ${error.message}`,
        details: {
          passkeyCredentialsRemoved: 0,
          adminInvitesCleared: 0,
          adminsRemoved: 0,
          securityChallengesCleared: 0
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  public async getAuthenticationStats(): Promise<any> {
    try {
      const db = await getDatabase();

      const stats = await db.all(`
        SELECT 
          (SELECT COUNT(*) FROM admins) as total_admins,
          (SELECT COUNT(*) FROM passkey_credentials) as total_passkeys,
          (SELECT COUNT(*) FROM admin_invites WHERE used = FALSE AND datetime('now') < datetime(expires_at)) as active_invites,
          (SELECT COUNT(*) FROM auth_challenges WHERE datetime('now') < datetime(expires_at)) as active_challenges,
          (SELECT MAX(last_login) FROM admins) as last_admin_login
      `);

      const recentLogins = await db.all(`
        SELECT display_name, last_login 
        FROM admins 
        WHERE last_login IS NOT NULL 
        ORDER BY last_login DESC 
        LIMIT 10
      `);

      const recentPasskeys = await db.all(`
        SELECT pc.device_name, pc.created_at, pc.last_used, a.display_name
        FROM passkey_credentials pc
        JOIN admins a ON pc.admin_id = a.id
        ORDER BY pc.created_at DESC
        LIMIT 10
      `);

      return {
        stats: stats[0],
        recentLogins,
        recentPasskeys,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return {
        error: `Failed to get authentication stats: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const forceSignoutService = ForceSignoutService.getInstance(); 