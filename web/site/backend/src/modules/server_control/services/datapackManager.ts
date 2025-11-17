import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend is at web/site/backend, we are in web/site/backend/src/modules/server_control/services
// BovisGL root is ../../../../../.. from here
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../../..');

/**
 * Datapack Manager Service
 * 
 * Manages datapack persistence for servers, specifically the anarchy server.
 * Copies datapacks from a persistent location to the world folder on server startup
 * to ensure datapacks survive world resets.
 */

// Persistent datapack storage location
const PERSISTENT_DATAPACKS_DIR = path.join(BOVISGL_ROOT, 'data packs');

// Anarchy world datapacks location  
const ANARCHY_WORLD_DATAPACKS_DIR = path.join(BOVISGL_ROOT, 'servers/anarchy/anarchy/datapacks');

export class DatapackManager {
  
  /**
   * Clear all datapacks from the anarchy world folder
   */
  async clearWorldDatapacks(): Promise<void> {
    try {
      // Check if datapacks directory exists
      const dirExists = await this.directoryExists(ANARCHY_WORLD_DATAPACKS_DIR);
      
      if (dirExists) {
        // Get all files and directories in the datapacks folder
        const items = await fs.readdir(ANARCHY_WORLD_DATAPACKS_DIR);
        
        // Remove each item
        for (const item of items) {
          const itemPath = path.join(ANARCHY_WORLD_DATAPACKS_DIR, item);
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            // Remove directory recursively
            await fs.rm(itemPath, { recursive: true, force: true });
          } else {
            // Remove file
            await fs.unlink(itemPath);
          }
        }
        
        console.log(`✅ Cleared ${items.length} items from anarchy world datapacks folder`);
      } else {
        console.log('📁 Anarchy world datapacks directory does not exist, creating it...');
        await fs.mkdir(ANARCHY_WORLD_DATAPACKS_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('❌ Error clearing world datapacks:', error);
      throw error;
    }
  }
  
  /**
   * Copy datapacks from persistent storage to anarchy world folder
   */
  async copyPersistentDatapacks(): Promise<void> {
    try {
      // Check if persistent datapacks directory exists
      const persistentDirExists = await this.directoryExists(PERSISTENT_DATAPACKS_DIR);
      
      if (!persistentDirExists) {
        console.log('📁 Persistent datapacks directory does not exist, creating it...');
        await fs.mkdir(PERSISTENT_DATAPACKS_DIR, { recursive: true });
        console.log('ℹ️  No persistent datapacks to copy');
        return;
      }
      
      // Ensure world datapacks directory exists
      await fs.mkdir(ANARCHY_WORLD_DATAPACKS_DIR, { recursive: true });
      
      // Get all items in persistent datapacks directory
      const items = await fs.readdir(PERSISTENT_DATAPACKS_DIR);
      
      if (items.length === 0) {
        console.log('ℹ️  No persistent datapacks found to copy');
        return;
      }
      
      // Copy each item
      let copiedCount = 0;
      for (const item of items) {
        const sourcePath = path.join(PERSISTENT_DATAPACKS_DIR, item);
        const targetPath = path.join(ANARCHY_WORLD_DATAPACKS_DIR, item);
        
        try {
          const stats = await fs.stat(sourcePath);
          
          if (stats.isDirectory()) {
            // Copy directory recursively using cp command for better performance
            await execAsync(`cp -r "${sourcePath}" "${targetPath}"`);
          } else {
            // Copy file
            await fs.copyFile(sourcePath, targetPath);
          }
          
          copiedCount++;
          console.log(`📦 Copied datapack: ${item}`);
        } catch (copyError) {
          console.error(`❌ Failed to copy datapack ${item}:`, copyError);
          // Continue with other datapacks even if one fails
        }
      }
      
      console.log(`✅ Successfully copied ${copiedCount}/${items.length} persistent datapacks to anarchy world`);
    } catch (error) {
      console.error('❌ Error copying persistent datapacks:', error);
      throw error;
    }
  }
  
  /**
   * Full datapack management process for anarchy server startup
   * Clears existing datapacks and copies persistent ones
   */
  async manageAnarchyDatapacks(): Promise<void> {
    console.log('🔄 Managing datapacks for anarchy server startup...');
    
    try {
      // Step 1: Clear existing datapacks
      await this.clearWorldDatapacks();
      
      // Step 2: Copy persistent datapacks
      await this.copyPersistentDatapacks();
      
      console.log('✅ Anarchy datapack management completed successfully');
    } catch (error) {
      console.error('❌ Anarchy datapack management failed:', error);
      throw error;
    }
  }
  
  /**
   * List persistent datapacks available
   */
  async listPersistentDatapacks(): Promise<string[]> {
    try {
      const dirExists = await this.directoryExists(PERSISTENT_DATAPACKS_DIR);
      
      if (!dirExists) {
        return [];
      }
      
      const items = await fs.readdir(PERSISTENT_DATAPACKS_DIR);
      const datapacks: string[] = [];
      
      for (const item of items) {
        const itemPath = path.join(PERSISTENT_DATAPACKS_DIR, item);
        const stats = await fs.stat(itemPath);
        
        // Include both files and directories
        datapacks.push(item);
      }
      
      return datapacks;
    } catch (error) {
      console.error('❌ Error listing persistent datapacks:', error);
      return [];
    }
  }
  
  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const datapackManager = new DatapackManager(); 