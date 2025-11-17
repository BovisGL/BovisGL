import { Pool, PoolClient } from 'pg';

interface LuckPermsUser {
  uuid: string;
  username: string;
  primaryGroup: string;
  permissions: LuckPermsPermission[];
  groups: string[];
}

interface LuckPermsGroup {
  name: string;
  permissions: LuckPermsPermission[];
  weight?: number;
}

interface LuckPermsPermission {
  id: number;
  permission: string;
  value: boolean;
  server: string;
  world: string;
  expiry: number;
  contexts: any;
}

interface LuckPermsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class LuckPermsService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'luckperms',
      user: 'luckperms',
      password: 'bovisgl2025',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<LuckPermsResponse<any>> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as timestamp, COUNT(*) as user_count FROM luckperms_players');
      client.release();
      
      return {
        success: true,
        data: {
          connected: true,
          timestamp: result.rows[0].timestamp,
          userCount: parseInt(result.rows[0].user_count)
        }
      };
    } catch (error: any) {
      console.error('LuckPerms Database Connection Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all users with their permissions
   */
  async getAllUsers(): Promise<LuckPermsResponse<LuckPermsUser[]>> {
    try {
      const client = await this.pool.connect();
      
      // Get all players with their permissions
      const query = `
        SELECT 
          p.uuid,
          p.username,
          p.primary_group,
          up.id as permission_id,
          up.permission,
          up.value,
          up.server,
          up.world,
          up.expiry,
          up.contexts
        FROM luckperms_players p
        LEFT JOIN luckperms_user_permissions up ON p.uuid = up.uuid
        ORDER BY p.username, up.permission
      `;
      
      const result = await client.query(query);
      client.release();

      // Group permissions by user
      const usersMap = new Map<string, LuckPermsUser>();
      
      for (const row of result.rows) {
        if (!usersMap.has(row.uuid)) {
          usersMap.set(row.uuid, {
            uuid: row.uuid,
            username: row.username,
            primaryGroup: row.primary_group,
            permissions: [],
            groups: []
          });
        }
        
        const user = usersMap.get(row.uuid)!;
        
        if (row.permission_id) {
          user.permissions.push({
            id: row.permission_id,
            permission: row.permission,
            value: row.value,
            server: row.server,
            world: row.world,
            expiry: row.expiry,
            contexts: row.contexts ? JSON.parse(row.contexts) : {}
          });
          
          // Extract groups from permissions (group.groupname)
          if (row.permission.startsWith('group.') && row.value) {
            const groupName = row.permission.substring(6);
            if (!user.groups.includes(groupName)) {
              user.groups.push(groupName);
            }
          }
        }
      }

      return {
        success: true,
        data: Array.from(usersMap.values())
      };
    } catch (error: any) {
      console.error('Error fetching users:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get specific user by UUID
   */
  async getUser(uuid: string): Promise<LuckPermsResponse<LuckPermsUser>> {
    try {
      const client = await this.pool.connect();
      
      // Get player info
      const playerQuery = 'SELECT * FROM luckperms_players WHERE uuid = $1';
      const playerResult = await client.query(playerQuery, [uuid]);
      
      if (playerResult.rows.length === 0) {
        client.release();
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      const player = playerResult.rows[0];
      
      // Get user permissions
      const permQuery = 'SELECT * FROM luckperms_user_permissions WHERE uuid = $1';
      const permResult = await client.query(permQuery, [uuid]);
      
      client.release();

      const permissions: LuckPermsPermission[] = permResult.rows.map(row => ({
        id: row.id,
        permission: row.permission,
        value: row.value,
        server: row.server,
        world: row.world,
        expiry: row.expiry,
        contexts: row.contexts ? JSON.parse(row.contexts) : {}
      }));

      // Extract groups
      const groups = permissions
        .filter(perm => perm.permission.startsWith('group.') && perm.value)
        .map(perm => perm.permission.substring(6));

      return {
        success: true,
        data: {
          uuid: player.uuid,
          username: player.username,
          primaryGroup: player.primary_group,
          permissions,
          groups
        }
      };
    } catch (error: any) {
      console.error('Error fetching user:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all groups with their permissions
   */
  async getAllGroups(): Promise<LuckPermsResponse<LuckPermsGroup[]>> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT 
          g.name,
          gp.id as permission_id,
          gp.permission,
          gp.value,
          gp.server,
          gp.world,
          gp.expiry,
          gp.contexts
        FROM luckperms_groups g
        LEFT JOIN luckperms_group_permissions gp ON g.name = gp.name
        ORDER BY g.name, gp.permission
      `;
      
      const result = await client.query(query);
      client.release();

      // Group permissions by group
      const groupsMap = new Map<string, LuckPermsGroup>();
      
      for (const row of result.rows) {
        if (!groupsMap.has(row.name)) {
          groupsMap.set(row.name, {
            name: row.name,
            permissions: [],
            weight: 0 // Default weight, could be extracted from metadata if needed
          });
        }
        
        const group = groupsMap.get(row.name)!;
        
        if (row.permission_id) {
          group.permissions.push({
            id: row.permission_id,
            permission: row.permission,
            value: row.value,
            server: row.server,
            world: row.world,
            expiry: row.expiry,
            contexts: row.contexts ? JSON.parse(row.contexts) : {}
          });
        }
      }

      return {
        success: true,
        data: Array.from(groupsMap.values())
      };
    } catch (error: any) {
      console.error('Error fetching groups:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user has OP permission on a specific server
   */
  async isUserOp(uuid: string, serverId: string): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT * FROM luckperms_user_permissions 
        WHERE uuid = $1 
        AND permission IN ('op', 'minecraft.command.op') 
        AND value = true 
        AND (server = $2 OR server = 'global')
      `;
      
      const result = await client.query(query, [uuid, serverId]);
      client.release();
      
      return result.rows.length > 0;
    } catch (error: any) {
      console.error('Error checking OP status:', error.message);
      return false;
    }
  }

  /**
   * Get user permissions for a specific server
   */
  async getUserPermissionsForServer(uuid: string, serverId: string): Promise<LuckPermsResponse<LuckPermsPermission[]>> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT * FROM luckperms_user_permissions 
        WHERE uuid = $1 
        AND (server = $2 OR server = 'global')
        ORDER BY permission
      `;
      
      const result = await client.query(query, [uuid, serverId]);
      client.release();

      const permissions: LuckPermsPermission[] = result.rows.map(row => ({
        id: row.id,
        permission: row.permission,
        value: row.value,
        server: row.server,
        world: row.world,
        expiry: row.expiry,
        contexts: row.contexts ? JSON.parse(row.contexts) : {}
      }));

      return {
        success: true,
        data: permissions
      };
    } catch (error: any) {
      console.error('Error fetching user permissions for server:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all permissions data (users and groups)
   */
  async getAllPermissionsData(): Promise<LuckPermsResponse<{ users: LuckPermsUser[], groups: LuckPermsGroup[] }>> {
    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        this.getAllUsers(),
        this.getAllGroups()
      ]);

      if (!usersResponse.success) {
        return {
          success: false,
          error: `Failed to fetch users: ${usersResponse.error}`
        };
      }

      if (!groupsResponse.success) {
        return {
          success: false,
          error: `Failed to fetch groups: ${groupsResponse.error}`
        };
      }

      return {
        success: true,
        data: {
          users: usersResponse.data || [],
          groups: groupsResponse.data || []
        }
      };
    } catch (error: any) {
      console.error('Error fetching all permissions data:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default new LuckPermsService(); 