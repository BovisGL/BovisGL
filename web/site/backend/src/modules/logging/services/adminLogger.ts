import fs from 'fs/promises';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { adminLogOps } from '../../auth/services/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Centralized Admin Action Logging Service
 * 
 * Provides consistent logging for all admin actions across the application.
 * Logs are stored in the database for security auditing and monitoring.
 * Database is located at: web/site/backend/data/admins/admins.db
 */

/**
 * Logs an admin action with standardized formatting
 * 
 * @param adminName - Name of the admin performing the action (uses "Admin" as fallback if not available)
 * @param action - Type of action being performed (e.g., 'SERVER_START', 'LOGIN_SUCCESS')
 * @param success - Whether the action was successful
 * @param ip - IP address of the client
 * @param details - Optional additional details about the action
 */
export const logAdminAction = async (
  adminName: string | null | undefined, 
  action: string, 
  success: boolean, 
  ip: string, 
  details?: string
): Promise<void> => {
  try {
    const status = success ? 'SUCCESS' : 'FAILED';
    // Use "Admin" as fallback if adminName is not available
    const safeAdminName = adminName || 'Admin';
    await adminLogOps.create(safeAdminName, action, status, ip, details);
  } catch (error) {
    // Log to console if database logging fails (don't throw to avoid breaking main functionality)
    console.error('Failed to write admin action log to database:', error);
  }
};

/**
 * Retrieves recent admin logs from database
 * 
 * @param maxLines - Maximum number of recent entries to retrieve (default: 100)
 * @returns Array of log entries with structured data
 */
export const getAdminLogs = async (maxLines: number = 100): Promise<any[]> => {
  try {
    const logs = await adminLogOps.getRecent(maxLines);
    
    // Convert database format to legacy format for backward compatibility
    return logs.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      status: log.status,
      adminName: log.admin_name,
      action: log.action,
      ip: log.ip_address,
      details: log.details || '',
      raw: `[${log.timestamp}] ${log.status} | ${log.admin_name} | ${log.action} | ${log.ip_address}${log.details ? ` | ${log.details}` : ''}`
    }));
  } catch (error) {
    console.error('Failed to read admin logs from database:', error);
    return [];
  }
};

/**
 * Formats log entries for display (now returns database entries directly)
 * 
 * @param logs - Log entries from database
 * @returns Formatted log entries (already structured from database)
 */
export const formatLogEntries = (logs: any[]) => {
  // Logs are already formatted from database, just ensure consistent structure
  return logs.map(log => ({
    id: log.id || null,
    timestamp: log.timestamp || '',
    status: log.status || 'UNKNOWN',
    adminName: log.adminName || log.admin_name || '',
    action: log.action || '',
    ip: log.ip || log.ip_address || '',
    details: log.details || '',
    raw: log.raw || `[${log.timestamp}] ${log.status} | ${log.adminName || log.admin_name} | ${log.action} | ${log.ip || log.ip_address}${log.details ? ` | ${log.details}` : ''}`
  }));
};

/**
 * Clears admin logs (for maintenance purposes)
 * WARNING: This permanently deletes all admin action history
 */
export const clearAdminLogs = async (): Promise<void> => {
  try {
    const deletedCount = await adminLogOps.clear();
    console.log(`Cleared ${deletedCount} admin log entries from database`);
  } catch (error) {
    console.error('Failed to clear admin logs from database:', error);
    throw error;
  }
};

/**
 * Get admin logs by specific admin name
 */
export const getAdminLogsByAdmin = async (adminName: string, limit: number = 100): Promise<any[]> => {
  try {
    const logs = await adminLogOps.getByAdmin(adminName, limit);
    return logs.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      status: log.status,
      adminName: log.admin_name,
      action: log.action,
      ip: log.ip_address,
      details: log.details || '',
      raw: `[${log.timestamp}] ${log.status} | ${log.admin_name} | ${log.action} | ${log.ip_address}${log.details ? ` | ${log.details}` : ''}`
    }));
  } catch (error) {
    console.error('Failed to read admin logs by admin from database:', error);
    return [];
  }
};

/**
 * Get admin logs by specific action type
 */
export const getAdminLogsByAction = async (action: string, limit: number = 100): Promise<any[]> => {
  try {
    const logs = await adminLogOps.getByAction(action, limit);
    return logs.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      status: log.status,
      adminName: log.admin_name,
      action: log.action,
      ip: log.ip_address,
      details: log.details || '',
      raw: `[${log.timestamp}] ${log.status} | ${log.admin_name} | ${log.action} | ${log.ip_address}${log.details ? ` | ${log.details}` : ''}`
    }));
  } catch (error) {
    console.error('Failed to read admin logs by action from database:', error);
    return [];
  }
};

/**
 * Get total count of admin logs
 */
export const getAdminLogsCount = async (): Promise<number> => {
  try {
    return await adminLogOps.count();
  } catch (error) {
    console.error('Failed to get admin logs count from database:', error);
    return 0;
  }
};

/**
 * Delete old admin logs (cleanup)
 */
export const deleteOldAdminLogs = async (days: number = 90): Promise<number> => {
  try {
    const deletedCount = await adminLogOps.deleteOlderThan(days);
    console.log(`Deleted ${deletedCount} admin log entries older than ${days} days`);
    return deletedCount;
  } catch (error) {
    console.error('Failed to delete old admin logs from database:', error);
    return 0;
  }
}; 