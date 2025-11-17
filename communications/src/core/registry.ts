import { v4 as uuid } from 'uuid';

export interface RegisteredServer {
  id: string;
  name: string;
  type: string; // hub, proxy, anarchy, etc.
  host: string;
  port: number;
  version?: string;
  maxPlayers?: number;
  currentPlayers?: number;
  status: 'online' | 'offline';
  lastHeartbeat: number;
  firstSeen: number;
  meta?: Record<string, any>;
}

class ServerRegistry {
  private servers = new Map<string, RegisteredServer>();

  register(partial: Omit<RegisteredServer, 'id' | 'lastHeartbeat' | 'firstSeen' | 'status'> & { status?: 'online' | 'offline' }): RegisteredServer {
    const existing = this.findByName(partial.name);
    const now = Date.now();
    if (existing) {
      existing.type = partial.type;
      existing.host = partial.host;
      existing.port = partial.port;
      existing.version = partial.version;
      existing.maxPlayers = partial.maxPlayers;
      existing.currentPlayers = partial.currentPlayers;
      existing.lastHeartbeat = now;
      existing.status = partial.status ?? 'online';
      existing.meta = partial.meta;
      return existing;
    }
    const created: RegisteredServer = {
      id: uuid(),
      name: partial.name,
      type: partial.type,
      host: partial.host,
      port: partial.port,
      version: partial.version,
      maxPlayers: partial.maxPlayers,
      currentPlayers: partial.currentPlayers,
      status: partial.status ?? 'online',
      lastHeartbeat: now,
      firstSeen: now,
      meta: partial.meta || {}
    };
    this.servers.set(created.id, created);
    return created;
  }

  heartbeat(name: string, payload: Partial<Pick<RegisteredServer, 'currentPlayers' | 'maxPlayers' | 'version' | 'meta' | 'status'>> = {}): RegisteredServer | null {
    const srv = this.findByName(name);
    if (!srv) return null;
    srv.lastHeartbeat = Date.now();
    if (payload.currentPlayers !== undefined) srv.currentPlayers = payload.currentPlayers;
    if (payload.maxPlayers !== undefined) srv.maxPlayers = payload.maxPlayers;
    if (payload.version !== undefined) srv.version = payload.version;
    if (payload.meta !== undefined) srv.meta = { ...(srv.meta || {}), ...payload.meta };
    if (payload.status) srv.status = payload.status;
    return srv;
  }

  unregister(name: string): boolean {
    const srv = this.findByName(name);
    if (!srv) return false;
    this.servers.delete(srv.id);
    return true;
  }

  list(): RegisteredServer[] {
    return [...this.servers.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  findByName(name: string): RegisteredServer | undefined {
    name = name.toLowerCase();
    return this.list().find(s => s.name.toLowerCase() === name);
  }
}

export const serverRegistry = new ServerRegistry();
