import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, chown, access, constants } from 'fs/promises';
import { spawn } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - use absolute path to always point to source data directory
// This ensures both the script and compiled app use the same database
const BACKEND_ROOT = join(__dirname, '../../../..');
const DB_PATH = join(BACKEND_ROOT, 'data/admins/admins.db');

let db: Database | null = null;

// Helper to fix file/directory ownership and prevent future permission issues
async function fixOwnership(filePath: string): Promise<void> {
  try {
    // Check if file/directory exists first
    await access(filePath);
    
    const currentUser = os.userInfo();
    const uid = currentUser.uid;
    const gid = currentUser.gid;
    
    // Change ownership to current user
    await chown(filePath, uid, gid);
    console.log(`✅ Fixed ownership of ${filePath} to ${currentUser.username}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, that's okay
      return;
    }
    
    // If regular chown fails, try with shell command (handles permission issues)
    console.log(`⚠️  Regular chown failed for ${filePath}: ${error.message}, trying shell command...`);
    try {
      const currentUser = os.userInfo();
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('chown', [`${currentUser.username}:${currentUser.username}`, filePath], { 
          stdio: ['inherit', 'pipe', 'pipe'] 
        });
        
        let stderr = '';
        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
        
        proc.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ Fixed ownership of ${filePath} using chown command`);
            resolve();
          } else {
            console.log(`⚠️  chown command failed with code ${code}: ${stderr}`);
            resolve(); // Don't reject - just continue
          }
        });
      });
    } catch (shellError: any) {
      console.log(`⚠️  Could not fix ownership using shell command: ${shellError.message}`);
    }
  }
}

// Check if database file is writable, fix ownership if needed
export async function ensureWritableDatabase(dbPath: string): Promise<void> {
  try {
    // Check if file exists and is writable
    await access(dbPath, constants.W_OK);
    console.log(`✅ Database is writable: ${dbPath}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️  Database doesn't exist yet: ${dbPath}`);
      return;
    }
    
    if (error.code === 'EACCES') {
      console.log(`⚠️  Database is not writable, fixing ownership: ${dbPath}`);
      await fixOwnership(dbPath);
      await fixOwnership(dirname(dbPath));
      
      // Test again
      try {
        await access(dbPath, constants.W_OK);
        console.log(`✅ Database is now writable: ${dbPath}`);
      } catch (retryError: any) {
        console.error(`❌ Failed to make database writable: ${dbPath}`, retryError.message);
        throw new Error(`Database permission issue: ${retryError.message}`);
      }
    } else {
      throw error;
    }
  }
}

// Initialize database connection and create tables
export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  // Ensure data directory exists with proper ownership
  const dataDir = dirname(DB_PATH);
  await mkdir(dataDir, { recursive: true });
  await fixOwnership(dataDir);
  
  // Check if database will be writable before proceeding
  await ensureWritableDatabase(DB_PATH);
  
  // Create database
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  // Immediately fix ownership of the database file
  await fixOwnership(DB_PATH);

  // Create tables if they don't exist
  await db.exec(`
    -- Admin invites table (simplified to just use name)
    CREATE TABLE IF NOT EXISTS admin_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invite_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      used_at DATETIME NULL
    );

    -- Admins table (using name as primary identifier)
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL,
  mc_username TEXT NULL
    );

    -- Passkey credentials table
    CREATE TABLE IF NOT EXISTS passkey_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      device_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME NULL,
      FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
    );

    -- Session challenges table (for WebAuthn challenges)
    CREATE TABLE IF NOT EXISTS auth_challenges (
      id TEXT PRIMARY KEY,
      challenge TEXT NOT NULL,
      admin_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
    );

    -- Admin logs table for storing all admin actions
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
      ip_address TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for faster queries on admin logs
    CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_name ON admin_logs(admin_name);
    CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
  `);

  // Clean up expired challenges periodically (older than 10 minutes)
  await db.run(`
    DELETE FROM auth_challenges 
    WHERE datetime('now') > expires_at
  `);

  // Fix ownership after database creation
  await fixOwnership(DB_PATH);

  return db;
}

// Get database instance
export async function getDatabase(): Promise<Database> {
  if (!db) {
    return await initDatabase();
  }
  return db;
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

// Enhanced database operations with automatic permission fixing
export const inviteOps = {
  async findByToken(inviteCode: string) {
    await ensureWritableDatabase(DB_PATH); // Check permissions before any operation
    const db = await getDatabase();
    console.log('[DEBUG] Database path:', DB_PATH);
    console.log('[DEBUG] Looking for invite code:', inviteCode);
    const result = await db.get(`
      SELECT * FROM admin_invites 
      WHERE invite_code = ? AND used = FALSE AND datetime('now') < datetime(expires_at)
    `, [inviteCode]);
    console.log('[DEBUG] Database query result:', result);
    return result;
  },

  async markAsUsed(inviteCode: string) {
    await ensureWritableDatabase(DB_PATH); // Check permissions before any operation
    const db = await getDatabase();
    return await db.run(`
      UPDATE admin_invites 
      SET used = TRUE, used_at = CURRENT_TIMESTAMP 
      WHERE invite_code = ?
    `, [inviteCode]);
  },

  async deleteExpired() {
    await ensureWritableDatabase(DB_PATH); // Check permissions before any operation
    const db = await getDatabase();
    return await db.run(`
      DELETE FROM admin_invites 
      WHERE datetime('now') > expires_at OR used = TRUE
    `);
  }
};

// Enhanced database operations for admins
export const adminOps = {
  async findByName(name: string) {
    const db = await getDatabase();
    return await db.get(`
      SELECT * FROM admins 
      WHERE name = ?
    `, [name]);
  },

  async setMinecraftUsername(adminName: string, mcUsername: string) {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    await db.run(`UPDATE admins SET mc_username = ? WHERE name = ?`, [mcUsername, adminName]);
    return await db.get(`SELECT * FROM admins WHERE name = ?`, [adminName]);
  },

  async create(name: string) {
    await ensureWritableDatabase(DB_PATH); // Check permissions before any operation
    const db = await getDatabase();
    const result = await db.run(`
      INSERT INTO admins (name)
      VALUES (?)
    `, [name]);
    
    return await db.get(`SELECT * FROM admins WHERE id = ?`, [result.lastID]);
  },

  async findById(id: number) {
    const db = await getDatabase();
    return await db.get(`SELECT * FROM admins WHERE id = ?`, [id]);
  },

  async updateLastLogin(id: number) {
    await ensureWritableDatabase(DB_PATH); // Check permissions before any operation
    const db = await getDatabase();
    return await db.run(`
      UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?
    `, [id]);
  },

  async findAdminsWithCredentials() {
    try {
      const db = await getDatabase();
      console.log('[DEBUG] Running findAdminsWithCredentials query on DB:', DB_PATH);
      return await db.all(`
        SELECT DISTINCT a.id, a.name, a.created_at, a.last_login
        FROM admins a
        INNER JOIN passkey_credentials pc ON a.id = pc.admin_id
        ORDER BY a.name
      `);
    } catch (error: any) {
      console.error('Error in findAdminsWithCredentials:', error);
      // Surface a clearer error in non-production for debugging
      if (process.env.NODE_ENV === 'production') throw new Error('Database query failed');
      throw error;
    }
  }
};

// Enhanced database operations for passkey credentials
export const credentialOps = {
  async create(adminId: number, credentialId: string, publicKey: string, deviceName?: string) {
    await ensureWritableDatabase(DB_PATH); // Check permissions before any operation
    const db = await getDatabase();
    const result = await db.run(`
      INSERT INTO passkey_credentials (admin_id, credential_id, public_key, device_name)
      VALUES (?, ?, ?, ?)
    `, [adminId, credentialId, publicKey, deviceName]);
    
    return await db.get(`SELECT * FROM passkey_credentials WHERE id = ?`, [result.lastID]);
  },

  async findByCredentialId(credentialId: string) {
    const db = await getDatabase();
    return await db.get(`
      SELECT pc.*, a.name
      FROM passkey_credentials pc
      JOIN admins a ON pc.admin_id = a.id
      WHERE pc.credential_id = ?
    `, [credentialId]);
  },

  async findByAdminId(adminId: number) {
    const db = await getDatabase();
    return await db.all(`
      SELECT * FROM passkey_credentials 
      WHERE admin_id = ?
      ORDER BY created_at DESC
    `, [adminId]);
  },

  async updateCounter(credentialId: string, newCounter: number) {
    const db = await getDatabase();
    return await db.run(`
      UPDATE passkey_credentials 
      SET counter = ?, last_used = CURRENT_TIMESTAMP 
      WHERE credential_id = ?
    `, [newCounter, credentialId]);
  },

  async deleteByAdminId(adminId: number) {
    const db = await getDatabase();
    return await db.run(`
      DELETE FROM passkey_credentials WHERE admin_id = ?
    `, [adminId]);
  }
};

// Database operations for auth challenges
export const challengeOps = {
  async store(sessionId: string, challenge: string, adminId?: number) {
    const db = await getDatabase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    
    return await db.run(`
      INSERT OR REPLACE INTO auth_challenges (id, challenge, admin_id, expires_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, challenge, adminId, expiresAt]);
  },

  async get(sessionId: string) {
    const db = await getDatabase();
    return await db.get(`
      SELECT * FROM auth_challenges 
      WHERE id = ? AND datetime('now') < expires_at
    `, [sessionId]);
  },

  async delete(sessionId: string) {
    const db = await getDatabase();
    return await db.run(`
      DELETE FROM auth_challenges WHERE id = ?
    `, [sessionId]);
  },

  async cleanup() {
    const db = await getDatabase();
    await db.run(`
      DELETE FROM auth_challenges 
      WHERE datetime('now') > expires_at
    `);
  }
};

// Admin logs operations
export const adminLogOps = {
  async create(adminName: string, action: string, status: 'SUCCESS' | 'FAILED', ipAddress: string, details?: string) {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    const timestamp = new Date().toISOString();
    
    await db.run(`
      INSERT INTO admin_logs (timestamp, admin_name, action, status, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [timestamp, adminName, action, status, ipAddress, details || null]);
  },
  
  async getRecent(limit: number = 100) {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    
    return await db.all(`
      SELECT id, timestamp, admin_name, action, status, ip_address, details, created_at
      FROM admin_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [limit]);
  },
  
  async getByAdmin(adminName: string, limit: number = 100) {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    
    return await db.all(`
      SELECT id, timestamp, admin_name, action, status, ip_address, details, created_at
      FROM admin_logs 
      WHERE admin_name = ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [adminName, limit]);
  },
  
  async getByAction(action: string, limit: number = 100) {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    
    return await db.all(`
      SELECT id, timestamp, admin_name, action, status, ip_address, details, created_at
      FROM admin_logs 
      WHERE action = ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [action, limit]);
  },
  
  async deleteOlderThan(days: number = 90) {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await db.run(`
      DELETE FROM admin_logs 
      WHERE timestamp < ?
    `, [cutoffDate.toISOString()]);
    
    return result.changes || 0;
  },
  
  async clear() {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    
    const result = await db.run('DELETE FROM admin_logs');
    return result.changes || 0;
  },
  
  async count() {
    await ensureWritableDatabase(DB_PATH);
    const db = await getDatabase();
    
    const result = await db.get('SELECT COUNT(*) as count FROM admin_logs');
    return result?.count || 0;
  }
};

// Utility function to create database with proper ownership (for future use)
export async function createDatabaseWithOwnership(dbPath: string, createTables?: (db: Database) => Promise<void>): Promise<Database> {
  // Ensure directory exists with proper ownership
  const dbDir = dirname(dbPath);
  await mkdir(dbDir, { recursive: true });
  await fixOwnership(dbDir);
  
  // Create database
  const database = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Immediately fix ownership of the database file
  await fixOwnership(dbPath);
  
  // Create tables if function provided
  if (createTables) {
    await createTables(database);
  }
  
  console.log(`✅ Database created with proper ownership: ${dbPath}`);
  return database;
} 