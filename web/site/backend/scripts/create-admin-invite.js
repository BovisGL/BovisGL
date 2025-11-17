#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, chown } from 'fs/promises';
import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const DB_PATH = join(__dirname, '../data/admins/admins.db');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Check if running as root and exit if so
if (process.getuid && process.getuid() === 0) {
    console.error('\n❌ This script should not be run as root!');
    console.error('Please run it as the regular user (elijah) instead.');
    console.error('Usage: node scripts/create-admin-invite.js');
    process.exit(1);
}

// Generate secure random invite code (base64url, URL-safe, no padding)
function generateInviteCode() {
  const raw = crypto.randomBytes(24); // 24 bytes ~ 32 chars base64url
  return raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Function to fix ownership and permissions
function fixOwnership(filePath) {
  try {
        // Set permissions to read/write for owner and group
        fs.chmodSync(filePath, 0o664);
        
        // Get the current user info
        const currentUser = process.env.USER || process.env.USERNAME;
        console.log(`✅ Set permissions for ${filePath} (owner: ${currentUser})`);
        
        // If we can get the directory, fix its permissions too
        const dir = path.dirname(filePath);
        if (fs.existsSync(dir)) {
            fs.chmodSync(dir, 0o775);
            console.log(`✅ Set directory permissions for ${dir}`);
          }
    } catch (error) {
        console.error(`⚠️  Could not fix permissions for ${filePath}:`, error.message);
  }
}

// Initialize database
async function initDatabase() {
  // Ensure data directory exists
  await mkdir(join(__dirname, '../data/admins'), { recursive: true });
  
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invite_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      used_at DATETIME NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME NULL
    );
  `);

  // Close the database connection temporarily to fix ownership
  await db.close();
  
  // Fix ownership of the database file
  fixOwnership(DB_PATH);
  
  // Reopen the database
  const fixedDb = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  return fixedDb;
}

// Clean up expired and used invites
async function cleanupExpiredInvites(db) {
  const result = await db.run(`
    DELETE FROM admin_invites 
    WHERE datetime('now') > expires_at OR used = TRUE
  `);
  
  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} expired/used invite(s)`);
  }
}

// Check if admin already exists
async function checkExistingAdmin(db, name) {
  const existing = await db.get(`
    SELECT * FROM admins 
    WHERE name = ?
  `, [name]);
  
  return existing;
}

// Create new admin invite
async function createAdminInvite(db, name) {
  // Generate unique invite code
  let inviteCode;
  while (true) {
    inviteCode = generateInviteCode();
    const existing = await db.get(`SELECT invite_code FROM admin_invites WHERE invite_code = ?`, [inviteCode]);
    if (!existing) break;
  }
  
  // Calculate expiration (24 hours from now)
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
  
  // Insert invite into database
  await db.run(`
    INSERT INTO admin_invites (invite_code, name, expires_at)
    VALUES (?, ?, ?)
  `, [inviteCode, name, expiresAt]);
  
  return { inviteCode, expiresAt, name };
}

// Main script execution
async function main() {
  console.log('🔐 BovisGL Admin Invite Generator');
  console.log('=====================================\n');
  
  try {
    // Initialize database
    const db = await initDatabase();
    
    // Clean up expired invites first
    await cleanupExpiredInvites(db);
    
    // Get admin details from user
    console.log('Enter admin details:');
    const name = await question('Admin Name: ');
    
    if (!name || !name.trim()) {
      console.log('❌ Error: Admin name is required!');
      process.exit(1);
    }
    
    const adminName = name.trim();
    
    // Check if admin already exists
    const existingAdmin = await checkExistingAdmin(db, adminName);
    
    if (existingAdmin) {
      console.log(`\n⚠️  Admin "${adminName}" already exists!`);
      console.log('Creating a new invite link for existing admin...\n');
    }
    
    // Create the invite
  const { inviteCode, expiresAt } = await createAdminInvite(db, adminName);
  const inviteUrl = `https://bovisgl.xyz/admin/passkey/invite/${encodeURIComponent(inviteCode)}`;
    
    // Display results
    console.log('✅ Admin invite created successfully!\n');
    console.log('📋 Invite Details:');
    console.log('==================');
    console.log(`Admin Name: ${adminName}`);
  console.log(`Invite Code: ${inviteCode} (base64url)`);
    console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
    console.log(`\n🔗 Invite URL:`);
    console.log(`${inviteUrl}\n`);
    
    if (existingAdmin) {
      console.log('ℹ️  Note: This is a new invite for an existing admin.');
      console.log('   The admin will be able to register additional passkeys.');
    } else {
      console.log('ℹ️  Note: This invite is valid for 24 hours and single-use only.');
      console.log('   Once used or expired, it will be automatically deleted.');
    }
    
    // Show current invite count
    const totalInvites = await db.get(`
      SELECT COUNT(*) as count FROM admin_invites 
      WHERE datetime('now') < expires_at AND used = FALSE
    `);
    
    console.log(`\n📊 Active invites: ${totalInvites.count}`);
    
    await db.close();
    
  } catch (error) {
    console.error('❌ Error creating admin invite:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Admin invite generation cancelled.');
  rl.close();
  process.exit(0);
});

// Run the script
main(); 