import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { SERVER_CONFIG } from '../../server_control/serverConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, runs from web/site/backend/dist/modules/system/services
// BovisGL root is ../../../../../../.. from the dist folder (7 levels up)
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../../..');

const BACKUP_DIR = path.join(BOVISGL_ROOT, 'backups');
const KEEP = 2;

function execPromise(cmd: string) {
  return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

export async function initializeBackupService() {
  await fs.ensureDir(BACKUP_DIR);

  // Run immediately, then every 12 hours
  await runBackupPass(false).catch(err => console.error('Initial backup pass failed', err));
  setInterval(() => {
    runBackupPass(false).catch(err => console.error('Scheduled backup pass failed', err));
  }, 1000 * 60 * 60 * 12);

  console.log('✅ Backup service initialized (every 12 hours)');
}

export async function shutdownBackupService() {
  // nothing to cleanly shutdown for setInterval-based service
}

async function runBackupPass(dryRun = false) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Only consider hub and anarchy servers
  const targets = ['hub', 'anarchy'];

  for (const id of targets) {
    const cfg = SERVER_CONFIG[id as any];
    if (!cfg) {
      console.warn(`No server config for ${id}, skipping`);
      continue;
    }

    const serviceName = `bovisgl-${id}`;

    // Check systemd active state
    try {
      const { stdout } = await execPromise(`systemctl is-active ${serviceName}`);
      if (!stdout || !stdout.trim().startsWith('active')) {
        console.log(`${serviceName} not active, skipping backup for ${id}`);
        continue;
      }
    } catch (err) {
      console.log(`Failed to query systemd for ${serviceName}, skipping:`, err);
      continue;
    }

  // Determine world path - prefer configured worldDir, fallback to common locations
  // `ServerConfig` may not have worldDir typed, so guard access
  const worldDir = (cfg as any).worldDir ? (cfg as any).worldDir : path.join(BOVISGL_ROOT, 'servers', id, id);
    const outDir = path.join(BACKUP_DIR, id);
    await fs.ensureDir(outDir);

    const outFile = path.join(outDir, `${id}-world-${timestamp}.tar.gz`);
    console.log(`Backing up ${id} world from ${worldDir} -> ${outFile}`);

    if (dryRun) {
      console.log('[DRY] Would run tar here');
    } else {
      // Use tar to preserve permissions and avoid following symlinks
      await execPromise(`tar -C ${path.dirname(worldDir)} -czf ${outFile} ${path.basename(worldDir)}`);
    }

    // Rotation
    const files = (await fs.readdir(outDir))
      .filter(f => f.endsWith('.tar.gz'))
      .map(f => ({ f, ts: f }))
      .sort((a, b) => b.f.localeCompare(a.f));

    if (files.length > KEEP) {
      const toDelete = files.slice(KEEP);
      for (const item of toDelete) {
        const fp = path.join(outDir, item.f);
        console.log(`Deleting old backup ${fp}`);
        if (!dryRun) await fs.remove(fp);
      }
    }
  }
}
