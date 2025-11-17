import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, runs from web/site/backend/dist/modules/events/utils
// BovisGL root is ../../../../../../.. from the dist folder (7 levels up)
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../../..');

let cached: string | null = null;

export function getPluginSecret(): string | null {
  if (cached !== null) return cached;
  try {
  const p = path.join(BOVISGL_ROOT, 'secrets/plugin-requests.txt');
    const raw = readFileSync(p, 'utf8').trim();
    cached = raw.length > 0 ? raw : null;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function clearPluginSecretCache(){ cached = null; }
