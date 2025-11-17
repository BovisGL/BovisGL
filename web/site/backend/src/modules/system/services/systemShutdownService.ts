import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logSystemEvent } from '../../security/services/securityLogger.js';

const execAsync = promisify(exec);

export interface ShutdownStatus {
  success: boolean;
  message: string;
  details?: string[];
  timestamp: string;
}

export class SystemShutdownService {
  private static instance: SystemShutdownService;
  private isShuttingDown = false;

  private constructor() {}

  public static getInstance(): SystemShutdownService {
    if (!SystemShutdownService.instance) {
      SystemShutdownService.instance = new SystemShutdownService();
    }
    return SystemShutdownService.instance;
  }

  public async executeCompleteShutdown(adminId: string, adminName: string): Promise<ShutdownStatus> {
    if (this.isShuttingDown) {
      return {
        success: false,
        message: 'Shutdown already in progress',
        timestamp: new Date().toISOString()
      };
    }

    this.isShuttingDown = true;
    
    try {
      await logSystemEvent('SHUTDOWN_INITIATED', 'CRITICAL', `Complete system shutdown initiated by ${adminName}`, adminId);
      
      const results: string[] = [];
      const errors: string[] = [];

      // 1. Stop all BovisGL services
      const services = [
        'bovisgl-anarchy',
        'bovisgl-arena', 
        'bovisgl-civilization',
        'bovisgl-hub',
        'bovisgl-parkour',
  'bovisgl-proxy',
        'bovisgl-cloudflare-tunnel',
        'bovisgl-playit',
        'bovisgl-web'
      ];

      results.push('🔄 Stopping BovisGL services...');
      
      for (const service of services) {
        try {
          const { stdout, stderr } = await execAsync(`sudo systemctl stop ${service}`);
          results.push(`✅ Stopped ${service}`);
          if (stderr) {
            results.push(`⚠️  ${service} stderr: ${stderr.trim()}`);
          }
        } catch (error: any) {
          const errorMsg = `❌ Failed to stop ${service}: ${error.message}`;
          errors.push(errorMsg);
          results.push(errorMsg);
        }
      }

      // 2. Verify all services are stopped
      results.push('🔍 Verifying service shutdown...');
      
      for (const service of services) {
        try {
          const { stdout } = await execAsync(`systemctl is-active ${service}`);
          if (stdout.trim() === 'active') {
            const errorMsg = `⚠️  ${service} is still running after stop command`;
            errors.push(errorMsg);
            results.push(errorMsg);
          } else {
            results.push(`✅ ${service} confirmed stopped`);
          }
        } catch (error) {
          // Service is stopped (systemctl is-active returns error code when inactive)
          results.push(`✅ ${service} confirmed stopped`);
        }
      }

      // 3. Kill any remaining Java processes (Minecraft servers)
      results.push('🔄 Terminating any remaining Minecraft processes...');
      try {
        const { stdout: javaProcs } = await execAsync(`pgrep -f "java.*jar" || true`);
        if (javaProcs.trim()) {
          await execAsync(`pkill -f "java.*jar" || true`);
          results.push('✅ Terminated remaining Java processes');
        } else {
          results.push('✅ No remaining Java processes found');
        }
      } catch (error: any) {
        results.push(`⚠️  Java process cleanup: ${error.message}`);
      }

      // 4. Kill any remaining Node.js processes (except current one)
      results.push('🔄 Preparing to terminate backend...');
      results.push('⚠️  Backend will shut down after this response');

      const finalStatus: ShutdownStatus = {
        success: errors.length === 0,
        message: errors.length === 0 
          ? '🎉 Complete system shutdown successful' 
          : `⚠️  Shutdown completed with ${errors.length} errors`,
        details: results,
        timestamp: new Date().toISOString()
      };

      await logSystemEvent('SHUTDOWN_COMPLETED', 'CRITICAL', 
        `System shutdown ${finalStatus.success ? 'successful' : 'completed with errors'}. Errors: ${errors.length}`, 
        adminId);

      // Schedule backend shutdown after response is sent
      setTimeout(() => {
        console.log('\n🔴 CRITICAL: Complete system shutdown initiated');
        console.log('🔴 All BovisGL services stopped');
        console.log('🔴 To restart: cd <BovisGL-root> && sudo ./build.sh');
        console.log('🔴 Backend shutting down now...\n');
        process.exit(0);
      }, 1000);

      return finalStatus;

    } catch (error: any) {
      this.isShuttingDown = false;
      
      const errorStatus: ShutdownStatus = {
        success: false,
        message: `Shutdown failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };

      await logSystemEvent('SHUTDOWN_FAILED', 'CRITICAL', `System shutdown failed: ${error.message}`, adminId);
      
      return errorStatus;
    }
  }

  public async getSystemStatus(): Promise<any> {
    try {
      const services = [
        'bovisgl-anarchy',
        'bovisgl-arena', 
        'bovisgl-civilization',
        'bovisgl-hub',
        'bovisgl-parkour',
  'bovisgl-proxy',
        'bovisgl-cloudflare-tunnel',
        'bovisgl-playit',
        'bovisgl-web'
      ];

      const statusPromises = services.map(async (service) => {
        try {
          const { stdout } = await execAsync(`systemctl is-active ${service}`);
          return { service, status: stdout.trim(), active: stdout.trim() === 'active' };
        } catch (error) {
          return { service, status: 'inactive', active: false };
        }
      });

      const serviceStatuses = await Promise.all(statusPromises);
      
      // Get system resource info - using relative path
      const { stdout: memInfo } = await execAsync(`free -h | grep Mem`);
      // Note: df needs absolute path or current directory; we'll use current working directory of process
      const { stdout: diskInfo } = await execAsync(`df -h . | tail -1`);
      const { stdout: loadInfo } = await execAsync(`uptime`);

      return {
        services: serviceStatuses,
        systemInfo: {
          memory: memInfo.trim(),
          disk: diskInfo.trim(),
          load: loadInfo.trim()
        },
        timestamp: new Date().toISOString(),
        shutdownInProgress: this.isShuttingDown
      };

    } catch (error: any) {
      return {
        error: `Failed to get system status: ${error.message}`,
        timestamp: new Date().toISOString(),
        shutdownInProgress: this.isShuttingDown
      };
    }
  }
}

export const systemShutdownService = SystemShutdownService.getInstance(); 