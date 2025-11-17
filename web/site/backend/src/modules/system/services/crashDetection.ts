import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Tail } from 'tail';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend is at web/site/backend, we are in web/site/backend/src/modules/system/services
// BovisGL root is ../../../../../.. from here
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../..');

// Server configuration - should match serverServices.ts
const SERVER_CONFIG = {
  'proxy': {
    name: 'Proxy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/proxy'),
    logFile: path.join(BOVISGL_ROOT, 'servers/proxy/logs/latest.log')
  },
  'hub': {
    name: 'Hub',
    workingDir: path.join(BOVISGL_ROOT, 'servers/hub'),
    logFile: path.join(BOVISGL_ROOT, 'servers/hub/logs/latest.log')
  },
  'parkour': {
    name: 'Parkour',
    workingDir: path.join(BOVISGL_ROOT, 'servers/parkour'),
    logFile: path.join(BOVISGL_ROOT, 'servers/parkour/logs/latest.log')
  },
  'anarchy': {
    name: 'Anarchy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/anarchy'),
    logFile: path.join(BOVISGL_ROOT, 'servers/anarchy/logs/latest.log')
  },
  'arena': {
    name: 'Arena',
    workingDir: path.join(BOVISGL_ROOT, 'servers/arena'),
    logFile: path.join(BOVISGL_ROOT, 'servers/arena/logs/latest.log')
  },
  'civilization': {
    name: 'Civilization',
    workingDir: path.join(BOVISGL_ROOT, 'servers/civilization'),
    logFile: path.join(BOVISGL_ROOT, 'servers/civilization/logs/latest.log')
  }
};

type ServerId = keyof typeof SERVER_CONFIG;

// Enhanced crash report interface
export interface CrashReport {
  serverId: string;
  timestamp: Date;
  exitCode?: number | null;
  crashLogs: string[];
  logSnapshot: string;
  reason: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  systemState?: SystemState;
  previewWarnings?: string[];
  category: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown';
}

// System state during crash
export interface SystemState {
  memoryUsage?: string;
  cpuLoad?: string;
  diskSpace?: string;
  processInfo?: string;
  jvmHeapUsage?: string;
}

// Early warning interface
export interface EarlyWarning {
  serverId: string;
  timestamp: Date;
  warningType: 'memory_high' | 'cpu_high' | 'frequent_errors' | 'gc_pressure' | 'disk_low';
  severity: 'low' | 'moderate' | 'high';
  message: string;
  metrics?: Record<string, any>;
}

// Track crash reports and warnings
const crashReports: CrashReport[] = [];
const earlyWarnings: EarlyWarning[] = [];
const MAX_CRASH_REPORTS = 100; // Increased for better history
const MAX_EARLY_WARNINGS = 200;

// Track last known server status and metrics
const lastKnownStatus: Record<string, 'online' | 'offline' | 'starting' | 'stopping' | 'crashed'> = {};
const serverMetrics: Record<string, {
  lastMemoryCheck: Date;
  errorCount: number;
  lastErrorReset: Date;
  gcWarnings: number;
  lastGcWarningReset: Date;
}> = {};

// Real-time log monitoring
const logTails: Map<string, Tail> = new Map();
const activeMonitoring = new Set<string>();

// Enhanced crash detection patterns
const CRASH_PATTERNS = {
  critical: [
    { pattern: /Exception in server tick loop/i, category: 'performance' as const },
    { pattern: /java\.lang\.OutOfMemoryError/i, category: 'memory' as const },
    { pattern: /java\.lang\.StackOverflowError/i, category: 'memory' as const },
    { pattern: /Encountered an unexpected exception/i, category: 'system' as const },
    { pattern: /Fatal error/i, category: 'system' as const },
    { pattern: /Process crashed with exit code/i, category: 'system' as const },
    { pattern: /Service failed/i, category: 'system' as const },
    { pattern: /Server terminated unexpectedly/i, category: 'system' as const },
    { pattern: /JVM crash/i, category: 'system' as const },
    { pattern: /Process finished with exit code/i, category: 'system' as const },
    { pattern: /Could not reserve enough space for \d+KB object heap/i, category: 'memory' as const },
    { pattern: /Native memory allocation \(mmap\) failed/i, category: 'memory' as const },
    { pattern: /Compressed class space.*out of memory/i, category: 'memory' as const }
  ],
  high: [
    { pattern: /Emergency shutdown/i, category: 'system' as const },
    { pattern: /Server crash report/i, category: 'system' as const },
    { pattern: /Stopping server/i, category: 'system' as const },
    { pattern: /Shutting down/i, category: 'system' as const },
    { pattern: /java\.lang\.Error/i, category: 'system' as const },
    { pattern: /Failed to bind to port/i, category: 'network' as const },
    { pattern: /Address already in use/i, category: 'network' as const },
    { pattern: /Plugin .* disabled due to error/i, category: 'plugin' as const }
  ],
  moderate: [
    { pattern: /java\.lang\.NullPointerException/i, category: 'plugin' as const },
    { pattern: /java\.util\.ConcurrentModificationException/i, category: 'performance' as const },
    { pattern: /Internal server error/i, category: 'system' as const },
    { pattern: /Failed to start the minecraft server/i, category: 'system' as const },
    { pattern: /Connection timed out/i, category: 'network' as const },
    { pattern: /Lost connection to MySQL server/i, category: 'network' as const },
    { pattern: /Plugin .* generated an exception/i, category: 'plugin' as const }
  ],
  low: [
    { pattern: /java\.net\.SocketException/i, category: 'network' as const },
    { pattern: /Connection refused/i, category: 'network' as const },
    { pattern: /Connection reset/i, category: 'network' as const },
    { pattern: /java\.io\.IOException/i, category: 'system' as const }
  ]
};

// Early warning patterns
const WARNING_PATTERNS = {
  memory_pressure: [
    /GC overhead limit exceeded/i,
    /Allocation failure/i,
    /.*heap.*usage.*\d{2,3}%/i,
    /Memory usage warning/i
  ],
  performance_issues: [
    /server.*overloaded/i,
    /Can't keep up!/i,
    /Running \d+ms behind/i,
    /server tick loop.*took.*\d{3,}ms/i
  ],
  frequent_errors: [
    /Exception/i,
    /Error/i
  ]
};

// Enhanced crash detection function
export async function detectAndPreserveCrash(
  serverId: string, 
  newStatus: 'online' | 'offline' | 'starting' | 'stopping' | 'crashed', 
  exitCode?: number | null
): Promise<{ isCrashed: boolean, crashLogs: string[], reason: string }> {
  
  const config = SERVER_CONFIG[serverId as ServerId];
  if (!config) {
    return { isCrashed: false, crashLogs: [], reason: '' };
  }

  const lastStatus = lastKnownStatus[serverId] || 'offline';
  let isCrashed = false;
  let crashLogs: string[] = [];
  let reason = '';
  let severity: 'low' | 'moderate' | 'high' | 'critical' = 'low';
  let category: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown' = 'unknown';
  let systemState: SystemState = {};

  try {
    const latestLogPath = config.logFile;
    
    // Determine if this is an unexpected shutdown
    const unexpectedShutdown = lastStatus === 'online' && newStatus === 'offline';
    const serviceFailed = newStatus === 'crashed';
    
    if (unexpectedShutdown || serviceFailed) {
      // Collect system state during crash
      systemState = await collectSystemState(serverId);
      
      try {
        // Try to read the log file
        let logContent = '';
        try {
          const rawLogContent = await fs.readFile(latestLogPath, 'utf-8');
          // Filter out RCON spam from crash detection
          const logLines = rawLogContent.split('\n');
          const filteredLines = logLines.filter(line => {
            // Less aggressive filtering to preserve important logs
            return !line.includes('Thread RCON Client /127.0.0.1 started') &&
                   !line.includes('Thread RCON Client /127.0.0.1 shutting down');
          });
          logContent = filteredLines.join('\n');
        } catch (logError) {
          console.log(`[CRASH DETECT] Could not read log file for ${serverId}: ${logError}`);
          // If we can't read logs but detected unexpected shutdown, still mark as crashed
          if (unexpectedShutdown) {
            isCrashed = true;
            reason = 'Unexpected shutdown - log file inaccessible';
            severity = 'high';
            category = 'system';
            crashLogs.push(`Server went offline unexpectedly (last status: ${lastStatus})`);
          }
          return { isCrashed, crashLogs, reason };
        }

        const logLines = logContent.split('\n');
        const recentLines = logLines.slice(-200); // Increased analysis window
        
        // Advanced pattern analysis
        const analysisResult = analyzeLogPatterns(recentLines);
        
        // Stack trace detection with context
        const stackTraceInfo = analyzeStackTraces(recentLines);
        
        // Combine analysis results
        if (analysisResult.foundPatterns.length > 0) {
                isCrashed = true;
          crashLogs = analysisResult.foundPatterns;
          severity = analysisResult.highestSeverity;
          category = analysisResult.primaryCategory;
          reason = `${severity} ${category} issue: ${analysisResult.primaryReason}`;
        }

        // Enhanced stack trace analysis
        if (stackTraceInfo.hasStackTrace && analysisResult.foundPatterns.length > 0) {
          isCrashed = true;
          if (!reason) {
            reason = `Stack trace analysis: ${stackTraceInfo.primaryException || 'Unknown exception'}`;
            severity = 'moderate';
            category = 'plugin';
          }
          crashLogs.push(...stackTraceInfo.stackTraceLines.slice(0, 5)); // First 5 lines of stack trace
        }

        // Enhanced exit code analysis
        if (exitCode && exitCode > 1) {
          isCrashed = true;
          const exitCodeInfo = analyzeExitCode(exitCode);
          crashLogs.push(`Service terminated with exit code: ${exitCode} (${exitCodeInfo.meaning})`);
          if (!reason) {
            reason = `Abnormal exit: ${exitCodeInfo.meaning}`;
            severity = exitCodeInfo.severity;
            category = exitCodeInfo.category;
          }
        }

        // Check for gradual degradation indicators
        if (unexpectedShutdown && !isCrashed) {
          const degradationInfo = analyzeDegradation(recentLines);
          if (degradationInfo.hasIndicators) {
          isCrashed = true;
            reason = `Gradual degradation leading to crash: ${degradationInfo.primaryIndicator}`;
            severity = 'moderate';
            category = degradationInfo.category;
            crashLogs.push(...degradationInfo.indicators);
          }
        }

        // Get previous warnings for this server
        const recentWarnings = getRecentWarnings(serverId, 30); // Last 30 minutes
        
        // Preserve enhanced crash information
        if (isCrashed) {
          const crashReport: CrashReport = {
            serverId,
            timestamp: new Date(),
            exitCode,
            crashLogs,
            logSnapshot: logContent,
            reason,
            severity,
            systemState,
            previewWarnings: recentWarnings.map(w => `${w.warningType}: ${w.message}`),
            category
          };
          
          // Add to crash reports array
          crashReports.push(crashReport);
          
          // Keep only the last MAX_CRASH_REPORTS
          if (crashReports.length > MAX_CRASH_REPORTS) {
            crashReports.shift();
          }
          
          console.log(`[CRASH DETECTED] ${serverId}: ${reason} (Severity: ${severity}, Category: ${category})`);
        }
        
      } catch (error) {
        console.error(`[CRASH DETECT] Error analyzing crash for ${serverId}:`, error);
        // If we can't analyze but service failed, still mark as crashed
        if (serviceFailed) {
          isCrashed = true;
          reason = 'Service reported as failed by systemd';
          severity = 'high';
          category = 'system';
          crashLogs.push('Service status reported as failed');
        }
      }
    }
    
  } catch (error) {
    console.error(`[CRASH DETECT] Unexpected error in crash detection for ${serverId}:`, error);
  }
  
  // Update last known status
  lastKnownStatus[serverId] = newStatus;
  
  return { isCrashed, crashLogs, reason };
}

// Analyze log patterns with enhanced intelligence
function analyzeLogPatterns(logLines: string[]): {
  foundPatterns: string[];
  highestSeverity: 'low' | 'moderate' | 'high' | 'critical';
  primaryCategory: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown';
  primaryReason: string;
} {
  const foundPatterns: string[] = [];
  let highestSeverity: 'low' | 'moderate' | 'high' | 'critical' = 'low';
  let primaryCategory: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown' = 'unknown';
  let primaryReason = '';

  const severityOrder = { low: 1, moderate: 2, high: 3, critical: 4 };

  // Check all severity levels
  for (const [severityKey, patterns] of Object.entries(CRASH_PATTERNS)) {
    const severity = severityKey as keyof typeof CRASH_PATTERNS;
    
    for (const line of logLines) {
      for (const { pattern, category } of patterns) {
        if (pattern.test(line)) {
          foundPatterns.push(line.trim());
          
          if (severityOrder[severity] > severityOrder[highestSeverity]) {
            highestSeverity = severity;
            primaryCategory = category;
            primaryReason = line.trim();
          }
        }
      }
    }
  }

  return { foundPatterns, highestSeverity, primaryCategory, primaryReason };
}

// Analyze stack traces for better context
function analyzeStackTraces(logLines: string[]): {
  hasStackTrace: boolean;
  stackTraceLines: string[];
  primaryException?: string;
} {
  const stackTracePattern = /^\s+at\s+[\w.$]+\([\w.]+:\d+\)/;
  const exceptionPattern = /^([a-zA-Z.]+Exception|[a-zA-Z.]+Error):/;
  
  let hasStackTrace = false;
  const stackTraceLines: string[] = [];
  let primaryException: string | undefined;

  for (let i = 0; i < logLines.length; i++) {
    const line = logLines[i];
    
    // Check for exception headers
    const exceptionMatch = line.match(exceptionPattern);
    if (exceptionMatch) {
      primaryException = exceptionMatch[1];
      stackTraceLines.push(line.trim());
      
      // Look ahead for stack trace lines
      for (let j = i + 1; j < Math.min(i + 10, logLines.length); j++) {
        if (stackTracePattern.test(logLines[j])) {
          hasStackTrace = true;
          stackTraceLines.push(logLines[j].trim());
        } else if (logLines[j].trim() === '') {
          break; // End of stack trace
        }
      }
    }
  }

  return { hasStackTrace, stackTraceLines, primaryException };
}

// Analyze exit codes for better understanding
function analyzeExitCode(exitCode: number): {
  meaning: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  category: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown';
} {
  const exitCodeMeanings: Record<number, { 
    meaning: string; 
    severity: 'low' | 'moderate' | 'high' | 'critical'; 
    category: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown' 
  }> = {
    1: { meaning: 'General error', severity: 'moderate', category: 'system' },
    2: { meaning: 'Misuse of shell command', severity: 'low', category: 'system' },
    9: { meaning: 'Killed by SIGKILL', severity: 'high', category: 'system' },
    15: { meaning: 'Terminated by SIGTERM', severity: 'moderate', category: 'system' },
    127: { meaning: 'Command not found', severity: 'high', category: 'system' },
    130: { meaning: 'Script terminated by Ctrl+C', severity: 'low', category: 'system' },
    137: { meaning: 'Killed by SIGKILL (OOM)', severity: 'critical', category: 'memory' },
    143: { meaning: 'Terminated by SIGTERM', severity: 'moderate', category: 'system' }
  };

  return exitCodeMeanings[exitCode] || { 
    meaning: `Unknown exit code ${exitCode}`, 
    severity: 'moderate', 
    category: 'unknown' 
  };
}

// Analyze gradual degradation patterns
function analyzeDegradation(logLines: string[]): {
  hasIndicators: boolean;
  indicators: string[];
  primaryIndicator: string;
  category: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown';
} {
  const degradationPatterns = [
    { pattern: /Can't keep up!/i, category: 'performance' as const },
    { pattern: /server.*overloaded/i, category: 'performance' as const },
    { pattern: /Running \d+ms behind/i, category: 'performance' as const },
    { pattern: /GC overhead limit exceeded/i, category: 'memory' as const },
    { pattern: /Allocation failure/i, category: 'memory' as const },
    { pattern: /Too many connections/i, category: 'network' as const }
  ];

  const indicators: string[] = [];
  let primaryIndicator = '';
  let category: 'memory' | 'performance' | 'plugin' | 'system' | 'network' | 'unknown' = 'unknown';

  for (const line of logLines) {
    for (const { pattern, category: patternCategory } of degradationPatterns) {
      if (pattern.test(line)) {
        indicators.push(line.trim());
        if (!primaryIndicator) {
          primaryIndicator = line.trim();
          category = patternCategory;
        }
      }
    }
  }

  return {
    hasIndicators: indicators.length > 0,
    indicators,
    primaryIndicator,
    category
  };
}

// Collect system state during crash
async function collectSystemState(serverId: string): Promise<SystemState> {
  const systemState: SystemState = {};

  try {
    // Memory usage
    const { stdout: memInfo } = await execAsync('free -h | head -2');
    systemState.memoryUsage = memInfo.trim();

    // CPU load
    const { stdout: loadInfo } = await execAsync('uptime');
    systemState.cpuLoad = loadInfo.trim();

    // Disk space - using current directory as reference
    const { stdout: diskInfo } = await execAsync('df -h . | tail -1');
    systemState.diskSpace = diskInfo.trim();

    // Process info for the specific server
    const serviceName = `bovisgl-${serverId}`;
    try {
      const { stdout: processInfo } = await execAsync(`systemctl show --property=MainPID,MemoryCurrent,CPUUsageNSec ${serviceName}`);
      systemState.processInfo = processInfo.trim();
    } catch (error) {
      systemState.processInfo = 'Process info unavailable';
    }

    // JVM heap usage if available
    try {
      const { stdout: jstatInfo } = await execAsync(`jstat -gc $(pgrep -f "${serverId}.jar") 2>/dev/null || echo "JVM info unavailable"`);
      systemState.jvmHeapUsage = jstatInfo.trim();
    } catch (error) {
      systemState.jvmHeapUsage = 'JVM info unavailable';
    }

  } catch (error) {
    console.error(`Error collecting system state for ${serverId}:`, error);
  }

  return systemState;
}

// Start real-time monitoring for a server
export function startRealtimeMonitoring(serverId: string): void {
  if (activeMonitoring.has(serverId) || !SERVER_CONFIG[serverId as ServerId]) {
    return;
  }

  const config = SERVER_CONFIG[serverId as ServerId];
  const logFile = config.logFile;

  try {
    // Initialize metrics tracking
    if (!serverMetrics[serverId]) {
      serverMetrics[serverId] = {
        lastMemoryCheck: new Date(),
        errorCount: 0,
        lastErrorReset: new Date(),
        gcWarnings: 0,
        lastGcWarningReset: new Date()
      };
    }

    const tail = new Tail(logFile, { follow: true, fromBeginning: false });
    
    tail.on('line', (line: string) => {
      analyzeRealtimeLine(serverId, line);
    });

    tail.on('error', (error: any) => {
      console.error(`Error tailing log for ${serverId}:`, error);
      stopRealtimeMonitoring(serverId);
    });

    logTails.set(serverId, tail);
    activeMonitoring.add(serverId);
    
    console.log(`[MONITOR] Started real-time monitoring for ${serverId}`);

  } catch (error) {
    console.error(`Failed to start real-time monitoring for ${serverId}:`, error);
  }
}

// Stop real-time monitoring for a server
export function stopRealtimeMonitoring(serverId: string): void {
  const tail = logTails.get(serverId);
  if (tail) {
    tail.unwatch();
    logTails.delete(serverId);
  }
  
  activeMonitoring.delete(serverId);
  console.log(`[MONITOR] Stopped real-time monitoring for ${serverId}`);
}

// Analyze individual log lines in real-time
function analyzeRealtimeLine(serverId: string, line: string): void {
  const metrics = serverMetrics[serverId];
  if (!metrics) return;

  // Check for early warning patterns
  for (const [warningType, patterns] of Object.entries(WARNING_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        handleEarlyWarning(serverId, warningType as any, line, metrics);
        break;
      }
    }
  }

  // Track error frequency
  if (/error|exception/i.test(line) && !line.includes('RCON')) {
    metrics.errorCount++;
    
    // Reset counter every hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (metrics.lastErrorReset < hourAgo) {
      metrics.errorCount = 1;
      metrics.lastErrorReset = new Date();
    }

    // Trigger warning if error rate is high
    if (metrics.errorCount > 10) { // More than 10 errors per hour
      addEarlyWarning(serverId, 'frequent_errors', 'high', 
        `High error rate detected: ${metrics.errorCount} errors in the last hour`, 
        { errorCount: metrics.errorCount });
    }
  }
}

// Handle early warning detection
function handleEarlyWarning(serverId: string, warningType: string, line: string, metrics: any): void {
  const now = new Date();

  switch (warningType) {
    case 'memory_pressure':
      if (now.getTime() - metrics.lastMemoryCheck.getTime() > 5 * 60 * 1000) { // 5 minute cooldown
        addEarlyWarning(serverId, 'memory_high', 'moderate', 
          'Memory pressure detected in logs', { logLine: line });
        metrics.lastMemoryCheck = now;
      }
      break;

    case 'performance_issues':
      addEarlyWarning(serverId, 'cpu_high', 'moderate', 
        'Performance degradation detected', { logLine: line });
      break;
  }
}

// Add early warning
function addEarlyWarning(
  serverId: string, 
  warningType: EarlyWarning['warningType'], 
  severity: EarlyWarning['severity'],
  message: string, 
  metrics?: Record<string, any>
): void {
  const warning: EarlyWarning = {
    serverId,
    timestamp: new Date(),
    warningType,
    severity,
    message,
    metrics
  };

  earlyWarnings.push(warning);

  // Keep only recent warnings
  if (earlyWarnings.length > MAX_EARLY_WARNINGS) {
    earlyWarnings.shift();
  }

  console.log(`[EARLY WARNING] ${serverId}: ${warningType} - ${message}`);
}

// Get recent warnings for a server
function getRecentWarnings(serverId: string, minutesBack: number = 30): EarlyWarning[] {
  const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);
  return earlyWarnings
    .filter(w => w.serverId === serverId && w.timestamp > cutoff)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Enhanced public functions
export function getRecentCrashReports(serverId?: string, limit: number = 10): CrashReport[] {
  let reports = crashReports;
  
  if (serverId) {
    reports = reports.filter(report => report.serverId === serverId);
  }
  
  // Sort by timestamp (newest first) and limit
  return reports
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

export function getEarlyWarnings(serverId?: string, limit: number = 20): EarlyWarning[] {
  let warnings = earlyWarnings;
  
  if (serverId) {
    warnings = warnings.filter(w => w.serverId === serverId);
  }
  
  return warnings
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

export function clearCrashReports(serverId?: string): number {
  if (serverId) {
    const initialLength = crashReports.length;
    const filtered = crashReports.filter(report => report.serverId !== serverId);
    crashReports.length = 0;
    crashReports.push(...filtered);
    return initialLength - filtered.length;
  } else {
    const clearedCount = crashReports.length;
    crashReports.length = 0;
    return clearedCount;
  }
}

export function clearEarlyWarnings(serverId?: string): number {
  if (serverId) {
    const initialLength = earlyWarnings.length;
    const filtered = earlyWarnings.filter(w => w.serverId !== serverId);
    earlyWarnings.length = 0;
    earlyWarnings.push(...filtered);
    return initialLength - filtered.length;
  } else {
    const clearedCount = earlyWarnings.length;
    earlyWarnings.length = 0;
    return clearedCount;
  }
}

export function getCrashStatistics(): Record<string, { 
  totalCrashes: number; 
  lastCrash?: Date; 
  warningsCount: number;
  isMonitored: boolean;
}> {
  const stats: Record<string, { totalCrashes: number; lastCrash?: Date; warningsCount: number; isMonitored: boolean }> = {};
  
  for (const serverId of Object.keys(SERVER_CONFIG)) {
    const serverReports = crashReports.filter(report => report.serverId === serverId);
    const serverWarnings = earlyWarnings.filter(w => w.serverId === serverId);
    
    stats[serverId] = {
      totalCrashes: serverReports.length,
      lastCrash: serverReports.length > 0 ? 
        serverReports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp : 
        undefined,
      warningsCount: serverWarnings.length,
      isMonitored: activeMonitoring.has(serverId)
    };
  }
  
  return stats;
}

export function initializeCrashDetection(): void {
  for (const serverId of Object.keys(SERVER_CONFIG)) {
    lastKnownStatus[serverId] = 'offline';
    serverMetrics[serverId] = {
      lastMemoryCheck: new Date(),
      errorCount: 0,
      lastErrorReset: new Date(),
      gcWarnings: 0,
      lastGcWarningReset: new Date()
    };
  }
  console.log('Enhanced crash detection system initialized');
}

export function updateServerStatus(serverId: string, status: 'online' | 'offline' | 'starting' | 'stopping' | 'crashed'): void {
  const oldStatus = lastKnownStatus[serverId];
  lastKnownStatus[serverId] = status;

  // Start/stop real-time monitoring based on status
  if (status === 'online' && oldStatus !== 'online') {
    startRealtimeMonitoring(serverId);
  } else if (status !== 'online' && oldStatus === 'online') {
    stopRealtimeMonitoring(serverId);
  }
}

// Cleanup function for graceful shutdown
export function shutdownCrashDetection(): void {
  for (const serverId of activeMonitoring) {
    stopRealtimeMonitoring(serverId);
  }
  console.log('Crash detection system shut down');
} 