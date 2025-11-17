// System Module - Exports all system-related services
export { systemShutdownService } from './services/systemShutdownService.js';
export { 
  detectAndPreserveCrash, 
  getRecentCrashReports, 
  clearCrashReports,
  updateServerStatus,
  getCrashStatistics,
  initializeCrashDetection,
  getEarlyWarnings,
  clearEarlyWarnings,
  startRealtimeMonitoring,
  stopRealtimeMonitoring,
  shutdownCrashDetection,
  type CrashReport,
  type SystemState,
  type EarlyWarning
} from './services/crashDetection.js'; 