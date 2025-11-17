import net from 'net';

export interface RconServer {
  name: string;
  host: string;
  port: number;
  password: string;
}

export interface OnlinePlayer {
  server: string;
  name: string;
  uuid?: string | null;
}

// Simple RCON client for Minecraft servers (Source RCON protocol)
// Minimal implementation: authenticate, send 'list' command, parse result
class SimpleRcon {
  private socket: net.Socket;
  private idCounter = 1;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(private host: string, private port: number, private password: string, private timeoutMs = 2000) {
    this.socket = new net.Socket();
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const onErr = (e: any) => { if (!settled) { settled = true; reject(e); } };
      const onTimeout = () => { if (!settled) { settled = true; reject(new Error('RCON connect timeout')); } this.socket.destroy(); };
      this.socket.once('error', onErr);
      this.socket.setTimeout(this.timeoutMs, onTimeout);
      this.socket.connect(this.port, this.host, async () => {
        try {
          await this.authenticate();
          if (!settled) { settled = true; resolve(); }
        } catch (e) {
          if (!settled) { settled = true; reject(e); }
        }
      });
    });
  }

  close() {
    try { this.socket.destroy(); } catch {}
  }

  private async authenticate(): Promise<void> {
    const id = this.nextId();
    await this.writePacket(id, 3, this.password); // SERVERDATA_AUTH = 3
    const resp = await this.readPacket();
    if (resp.id !== id) throw new Error('RCON auth failed (bad id)');
    // Some servers send another empty response; read any pending small packet without blocking
  }

  async command(cmd: string): Promise<string> {
    const id = this.nextId();
    await this.writePacket(id, 2, cmd); // SERVERDATA_EXECCOMMAND = 2
    const resp = await this.readPacket();
    if (resp.id !== id) throw new Error('RCON command id mismatch');
    return resp.body || '';
  }

  private nextId() { return this.idCounter++; }

  private writePacket(id: number, type: number, body: string): Promise<void> {
    const bodyBuf = Buffer.from(body + '\u0000');
    const empty = Buffer.from('\u0000');
    const length = 4 + 4 + bodyBuf.length + empty.length;
    const buf = Buffer.alloc(4 + length);
    buf.writeInt32LE(length, 0);
    buf.writeInt32LE(id, 4);
    buf.writeInt32LE(type, 8);
    bodyBuf.copy(buf, 12);
    empty.copy(buf, 12 + bodyBuf.length);
    return new Promise((resolve, reject) => {
      this.socket.write(buf, err => err ? reject(err) : resolve());
    });
  }

  private readPacket(): Promise<{ id: number; type: number; body: string }>
  {
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= 4) {
          const length = this.buffer.readInt32LE(0);
          if (this.buffer.length < 4 + length) return; // wait for more
          const packet = this.buffer.subarray(4, 4 + length);
          this.buffer = this.buffer.subarray(4 + length);
          const id = packet.readInt32LE(0);
          const type = packet.readInt32LE(4);
          // Body ends before two nulls; slice excluding trailing two nulls if present
          let bodyRaw = packet.subarray(8);
          // strip trailing nulls
          while (bodyRaw.length > 0 && bodyRaw[bodyRaw.length - 1] === 0) bodyRaw = bodyRaw.subarray(0, bodyRaw.length - 1);
          const body = bodyRaw.toString('utf8');
          cleanup();
          resolve({ id, type, body });
          return;
        }
      };
      const onErr = (e: any) => { cleanup(); reject(e); };
      const onTimeout = () => { cleanup(); reject(new Error('RCON read timeout')); };
      const cleanup = () => {
        this.socket.off('data', onData);
        this.socket.off('error', onErr);
        this.socket.setTimeout(0);
      };
      this.socket.on('data', onData);
      this.socket.once('error', onErr);
      this.socket.setTimeout(2000, onTimeout);
    });
  }
}

export function loadRconServers(): RconServer[] {
  // Source order: env JSON > file at communications/data/rcon.json > empty
  try {
    const env = process.env.RCON_SERVERS_JSON;
    if (env) {
      const arr = JSON.parse(env);
      if (Array.isArray(arr)) return normalize(arr);
    }
  } catch {}
  try {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const p = path.join(process.cwd(), 'communications', 'data', 'rcon.json');
    if (fs.existsSync(p)) {
      const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(arr)) return normalize(arr);
    }
  } catch {}
  return [];

  function normalize(arr: any[]): RconServer[] {
    return arr.map((x: any) => ({
      name: String(x.name || x.server || 'server'),
      host: String(x.host || '127.0.0.1'),
      port: Number(x.port || 25575),
      password: String(x.password || '')
    })).filter(s => s.password);
  }
}

export async function queryOnlinePlayersViaRcon(servers: RconServer[], timeoutMs = 2500): Promise<OnlinePlayer[]> {
  const results: OnlinePlayer[] = [];
  await Promise.all(servers.map(async (s) => {
    try {
      const r = new SimpleRcon(s.host, s.port, s.password, timeoutMs);
      await r.connect();
      const out = await r.command('list');
      r.close();
      // Typical outputs:
      // "There are 1 of a max of 20 players online: Notch"
      // or for Velocity backend: depends; but Paper/Spigot gives above.
      const names = parseListNames(out);
      for (const n of names) results.push({ server: s.name, name: n, uuid: null });
    } catch (e) {
      // Swallow errors per server, continue others
    }
  }));
  return results;
}

function parseListNames(out: string): string[] {
  try {
    // Find the colon and take the segment after it
    const idx = out.indexOf(':');
    if (idx >= 0) {
      const seg = out.substring(idx + 1).trim();
      if (!seg) return [];
      return seg.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}
