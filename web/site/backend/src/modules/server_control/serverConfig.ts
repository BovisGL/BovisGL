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
  }
};

export type ServerId = keyof typeof SERVER_CONFIG;

export const VALID_SERVER_IDS: ServerId[] = Object.keys(SERVER_CONFIG) as ServerId[];

export function isValidServerId(id: string): id is ServerId {
  return id in SERVER_CONFIG;
} 