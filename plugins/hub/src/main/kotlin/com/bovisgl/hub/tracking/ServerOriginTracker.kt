package com.bovisgl.hub.tracking

import com.bovisgl.hub.BovisGLHubPlugin
import org.bukkit.entity.Player
import org.bukkit.event.EventHandler
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.configuration.file.YamlConfiguration
import java.io.File
import java.util.UUID

/**
 * Server Origin Tracker - Simple tracking for hub spawning
 * Uses stored data to determine spawn points for players
 */
class ServerOriginTracker(private val plugin: BovisGLHubPlugin) : Listener {
    
    private val originFile: File
    private val originConfig: YamlConfiguration
    private val playerOrigins = mutableMapOf<UUID, String>()
    
    init {
        originFile = File(plugin.dataFolder, "player-origins.yml")
        if (!originFile.exists()) {
            originFile.parentFile?.mkdirs()
            originFile.createNewFile()
        }
        originConfig = YamlConfiguration.loadConfiguration(originFile)
        loadOrigins()
    }
    
    fun initialize() {
        plugin.server.pluginManager.registerEvents(this, plugin)
        plugin.logger.info("Server Origin Tracker initialized (simple mode)")
    }
    
    private fun loadOrigins() {
        playerOrigins.clear()
        
        for (uuidString in originConfig.getKeys(false)) {
            try {
                val uuid = UUID.fromString(uuidString)
                val origin = originConfig.getString(uuidString)
                if (origin != null) {
                    playerOrigins[uuid] = origin
                }
            } catch (e: Exception) {
                plugin.logger.warning("Invalid UUID in origins file: $uuidString")
            }
        }
        
        plugin.logger.info("Loaded ${playerOrigins.size} player origins")
    }
    
    private fun saveOrigins() {
        for ((uuid, origin) in playerOrigins) {
            originConfig.set(uuid.toString(), origin)
        }
        
        try {
            originConfig.save(originFile)
        } catch (e: Exception) {
            plugin.logger.severe("Failed to save origins: ${e.message}")
        }
    }
    
    /**
     * Get the server a player came from
     */
    fun getPlayerOrigin(player: Player): String? {
        return playerOrigins[player.uniqueId]
    }
    
    /**
     * Set the server a player came from
     */
    fun setPlayerOrigin(player: Player, origin: String) {
        playerOrigins[player.uniqueId] = origin
        saveOrigins()
        plugin.logger.info("Set origin for ${player.name}: $origin")
    }
    
    @EventHandler
    fun onPlayerJoin(event: PlayerJoinEvent) {
        val player = event.player
        val origin = getPlayerOrigin(player)
        
        // Small delay to ensure player is fully loaded
        plugin.server.scheduler.runTaskLater(plugin, Runnable {
            // Use CustomSpawnManager to teleport to appropriate spawn
            plugin.customSpawnManager.teleportToSpawn(player, origin)
            
            plugin.logger.info("Player ${player.name} joined hub, origin: ${origin ?: "unknown"}")
        }, 10L) // 0.5 second delay
    }
}
