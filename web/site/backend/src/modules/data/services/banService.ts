import sqlite3 from 'sqlite3';
import path from 'path';
import { promisify } from 'util';

interface BanRecord {
    id: string;
    player_uuid: string;
    player_name: string;
    banned_by: string;
    banned_by_uuid: string | null;
    reason: string;
    banned_at: string;
    expires_at: string | null;
    active: number;
    pardoned_by: string | null;
    pardoned_by_uuid: string | null;
    pardoned_at: string | null;
    created_at: string;
    updated_at: string;
}

interface BanStatus {
    isBanned: boolean;
    banInfo?: {
        id: string;
        reason: string;
        bannedBy: string;
        bannedAt: string;
        expiresAt: string | null;
        timeRemaining?: number; // seconds until expiry, null for permanent
    };
}

class BanService {
    private db: sqlite3.Database;
    private dbGet: any;
    private dbAll: any;

    constructor() {
        const dbPath = path.join(process.cwd(), 'data', 'bans', 'bans.db');
        this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error opening ban database:', err);
            }
        });
        
        // Promisify database methods
        this.dbGet = promisify(this.db.get.bind(this.db));
        this.dbAll = promisify(this.db.all.bind(this.db));
    }

    /**
     * Get ban status for a player by UUID
     */
    async getBanStatus(playerUuid: string): Promise<BanStatus> {
        try {
            const sql = `
                SELECT * FROM bovisgl_bans 
                WHERE player_uuid = ? AND active = 1
                ORDER BY banned_at DESC
                LIMIT 1
            `;
            
            const banRecord = await this.dbGet(sql, [playerUuid]) as BanRecord | undefined;
            
            if (!banRecord) {
                return { isBanned: false };
            }

            // Check if ban has expired
            if (banRecord.expires_at) {
                const expiryTime = new Date(banRecord.expires_at).getTime();
                const currentTime = Date.now();
                
                if (currentTime >= expiryTime) {
                    return { isBanned: false };
                }
                
                const timeRemaining = Math.floor((expiryTime - currentTime) / 1000);
                
                return {
                    isBanned: true,
                    banInfo: {
                        id: banRecord.id,
                        reason: banRecord.reason,
                        bannedBy: banRecord.banned_by,
                        bannedAt: banRecord.banned_at,
                        expiresAt: banRecord.expires_at,
                        timeRemaining
                    }
                };
            } else {
                // Permanent ban
                return {
                    isBanned: true,
                    banInfo: {
                        id: banRecord.id,
                        reason: banRecord.reason,
                        bannedBy: banRecord.banned_by,
                        bannedAt: banRecord.banned_at,
                        expiresAt: null
                    }
                };
            }
        } catch (error) {
            console.error('Error getting ban status:', error);
            return { isBanned: false };
        }
    }

    /**
     * Get all active bans
     */
    async getAllActiveBans(): Promise<BanRecord[]> {
        try {
            const sql = `
                SELECT * FROM bovisgl_bans 
                WHERE active = 1
                ORDER BY banned_at DESC
            `;
            
            return await this.dbAll(sql, []) as BanRecord[];
        } catch (error) {
            console.error('Error getting all active bans:', error);
            return [];
        }
    }

    /**
     * Get ban history for a player
     */
    async getBanHistory(playerUuid: string): Promise<BanRecord[]> {
        try {
            const sql = `
                SELECT * FROM bovisgl_bans 
                WHERE player_uuid = ?
                ORDER BY banned_at DESC
            `;
            
            return await this.dbAll(sql, [playerUuid]) as BanRecord[];
        } catch (error) {
            console.error('Error getting ban history:', error);
            return [];
        }
    }

    /**
     * Close database connection
     */
    close(): void {
        this.db.close();
    }
}

export default new BanService();
export { BanService, BanStatus, BanRecord }; 