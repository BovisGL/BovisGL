// Centralized Server Configuration
// This file contains all server definitions and types used throughout the backend

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, backend runs from web/site/backend/dist/modules/server_control
// BovisGL root is ../../../../../.. from the dist folder (6 levels up)
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../..');

export interface ServerConfig {
  name: string;
  workingDir: string;
  jarPath: string;
  logFile: string;
  rconPort?: number;  // Make RCON optional
  rconPassword?: string;  // Make RCON optional
  port: number;
  color: string;
  ram: string;
}

export const SERVER_CONFIG: Record<string, ServerConfig> = {
  'proxy': {
    name: 'Proxy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/proxy'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/proxy/server.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/proxy/logs/latest.log'),
    // No RCON for Velocity proxy - it doesn't support it
    port: 25565,
    color: '#4CAF50',
    ram: '1G'
  },
  'hub': {
    name: 'Hub',
    workingDir: path.join(BOVISGL_ROOT, 'servers/hub'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/hub/server.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/hub/logs/latest.log'),
    rconPort: 25581, // Fixed port conflict with proxy
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLSecureRCON123!',
    port: 25566,
    color: '#2196F3',
    ram: '4G'
  },
  'parkour': {
    name: 'Parkour',
    workingDir: path.join(BOVISGL_ROOT, 'servers/parkour'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/parkour/server.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/parkour/logs/latest.log'),
    rconPort: 25576,
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLSecureRCON123!',
    port: 25567,
    color: '#FF9800',
    ram: '6G'
  },
  'anarchy': {
    name: 'Anarchy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/anarchy'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/anarchy/server.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/anarchy/logs/latest.log'),
    rconPort: 25580,
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLSecureRCON123!',
    port: 25570,
    color: '#F44336',
    ram: '18G'
  },
  'arena': {
    name: 'Arena',
    workingDir: path.join(BOVISGL_ROOT, 'servers/arena'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/arena/server.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/arena/logs/latest.log'),
    rconPort: 25577,
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLSecureRCON123!',
    port: 25568,
    color: '#9C27B0',
    ram: '6G'
  },
  'civilization': {
    name: 'Civilization',
    workingDir: path.join(BOVISGL_ROOT, 'servers/civilization'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/civilization/server.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/civilization/logs/latest.log'),
    rconPort: 25578,
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLSecureRCON123!',
    port: 25569,
    color: '#795548',
    ram: '10G'
  },
  // Test Servers
  'test-velocity': {
    name: 'Test Velocity Proxy',
    workingDir: path.join(BOVISGL_ROOT, 'servers/test/velocity'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/test/velocity/velocity-3.4.0-SNAPSHOT-528.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/test/velocity/logs/latest.log'),
    // No RCON for Velocity
    port: 31500,
    color: '#009688',
    ram: '512M'
  },
  'test-paper': {
    name: 'Test Paper Server',
    workingDir: path.join(BOVISGL_ROOT, 'servers/test/paper'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/test/paper/paper-1.21.8-40.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/test/paper/logs/latest.log'),
    rconPort: 31511,
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLTestRcon123!',
    port: 31501,
    color: '#3F51B5',
    ram: '2G'
  },
  'test-fabric': {
    name: 'Test Fabric Server',
    workingDir: path.join(BOVISGL_ROOT, 'servers/test/fabric'),
    jarPath: path.join(BOVISGL_ROOT, 'servers/test/fabric/fabric-server-mc.1.21.7-loader.0.17.2-launcher.1.1.0.jar'),
    logFile: path.join(BOVISGL_ROOT, 'servers/test/fabric/logs/latest.log'),
    rconPort: 31512,
    rconPassword: process.env.RCON_PASSWORD || 'BovisGLTestRcon123!',
    port: 31502,
    color: '#607D8B',
    ram: '2G'
  }
};

export type ServerId = keyof typeof SERVER_CONFIG;

export const VALID_SERVER_IDS: ServerId[] = Object.keys(SERVER_CONFIG) as ServerId[];

export function isValidServerId(id: string): id is ServerId {
  return id in SERVER_CONFIG;
} 