package com.bovisgl.hub.forcespawn

import com.bovisgl.hub.BovisGLHubPlugin
import org.bukkit.*
import org.bukkit.command.Command
import org.bukkit.command.CommandSender
import org.bukkit.entity.Player
import org.bukkit.event.EventHandler
import org.bukkit.event.EventPriority
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerQuitEvent
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer
import java.io.File
import java.util.*
import java.util.logging.Level

/**
 * ForceSpawn Manager - Handles forcing players to respawn at spawn point
 * 
 * This module deletes player data when they leave the server, forcing them
 * to respawn at the server's spawn point when they rejoin.
 */
class ForceSpawnManager(private val plugin: BovisGLHubPlugin) : Listener {
    
    private var enabled: Boolean = true
    private var deletePlayerData: Boolean = true
    private var deletePlayerAdvancements: Boolean = false
    private var deletePlayerStats: Boolean = false
    private var deletePlayerBackups: Boolean = true
    private var deletionDelay: Int = 5
    private var debug: Boolean = false
    private var joinMessageText: String = ""
    private var joinMessage: Component = Component.empty()
    private var forceTeleportOnJoin: Boolean = true
    
    fun initialize() {
        loadConfig()
        plugin.server.pluginManager.registerEvents(this, plugin)
        plugin.logger.info("ForceSpawn manager initialized")
    }
    
    fun shutdown() {
        plugin.logger.info("ForceSpawn manager shutdown")
    }
    
    fun reload() {
        loadConfig()
        plugin.logger.info("ForceSpawn configuration reloaded")
    }
    
    private fun loadConfig() {
        val config = plugin.config
        
        enabled = config.getBoolean("forcespawn.enabled", true)
        deletePlayerData = config.getBoolean("forcespawn.delete-player-data", true)
        deletePlayerAdvancements = config.getBoolean("forcespawn.delete-player-advancements", false)
        deletePlayerStats = config.getBoolean("forcespawn.delete-player-stats", false)
        deletePlayerBackups = config.getBoolean("forcespawn.delete-player-backups", true)
        deletionDelay = config.getInt("forcespawn.deletion-delay", 2)
        debug = config.getBoolean("forcespawn.debug", false)
        forceTeleportOnJoin = config.getBoolean("forcespawn.force-teleport-on-join", false)
        
        // Load and convert join message
        joinMessageText = config.getString("forcespawn.join-message", "") ?: ""
        joinMessage = if (joinMessageText.isNotEmpty()) {
            LegacyComponentSerializer.legacyAmpersand().deserialize(joinMessageText)
        } else {
            Component.empty()
        }
        
        // Validate deletion delay (minimum 1 second)
        if (deletionDelay < 1) {
            deletionDelay = 1
        }
        
        logDebug("Configuration loaded successfully")
    }
    
    private fun logDebug(message: String) {
        if (debug) {
            plugin.logger.info("[ForceSpawn Debug] $message")
        }
    }
    
    fun handleCommand(sender: CommandSender, command: Command, label: String, args: Array<String>): Boolean {
        if (!command.name.equals("forcespawn", ignoreCase = true)) {
            return false
        }
        
        if (!sender.hasPermission("bovisgl.forcespawn.admin")) {
            sender.sendMessage(
                Component.text("You don't have permission to use this command.")
                    .color(NamedTextColor.RED)
            )
            return true
        }
        
        if (args.isNotEmpty() && args[0].equals("reload", ignoreCase = true)) {
            reload()
            sender.sendMessage(
                Component.text("ForceSpawn configuration reloaded!")
                    .color(NamedTextColor.GREEN)
            )
            return true
        }
        
        // Default command - show help
        sender.sendMessage(
            Component.text("=== ForceSpawn Commands ===")
                .color(NamedTextColor.GOLD)
        )
        sender.sendMessage(
            Component.text("/forcespawn reload - Reload the configuration")
                .color(NamedTextColor.YELLOW)
        )
        return true
    }
    
    @EventHandler(priority = EventPriority.NORMAL)
    fun onPlayerQuit(event: PlayerQuitEvent) {
        if (!enabled || !deletePlayerData) {
            return
        }
        
        val player = event.player
        val playerUUID = player.uniqueId
        
        // Schedule delayed task to delete player data after server has saved
        Bukkit.getScheduler().runTaskLater(plugin, Runnable {
            deletePlayerData(playerUUID)
        }, (deletionDelay * 20L)) // Convert seconds to ticks
    }
    
    @EventHandler(priority = EventPriority.HIGH)
    fun onPlayerJoin(event: PlayerJoinEvent) {
        if (!enabled) {
            return
        }
        
        val player = event.player
        
        // Send join message if configured
        if (joinMessageText.isNotEmpty()) {
            // Allow a placeholder %name% in the configured message to be replaced with the player's name
            val rendered = joinMessageText.replace("%name%", player.name)
            val comp = LegacyComponentSerializer.legacyAmpersand().deserialize(rendered)
            player.sendMessage(comp)
        }
        
        // Force teleport to spawn if enabled
        if (forceTeleportOnJoin) {
            // Use a delayed task to ensure teleport happens after the player fully joins
            Bukkit.getScheduler().runTaskLater(plugin, Runnable {
                val world = Bukkit.getWorlds()[0]
                val spawnLocation = world.spawnLocation
                player.teleport(spawnLocation)
                if (debug) {
                    plugin.logger.info(
                        "[ForceSpawn Debug] Teleported ${player.name} to spawn at " +
                        "${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z}"
                    )
                }
            }, 10L) // Half-second delay
        }
    }
    
    private fun deletePlayerData(playerUUID: UUID) {
        // Get server world container (where world folders are stored)
        val worldContainer = Bukkit.getWorldContainer()
        val uuidString = playerUUID.toString()
        
        // World folders to check (typically the main world and nether/end dimensions)
        for (world in Bukkit.getWorlds()) {
            val worldName = world.name
            logDebug("Checking world: $worldName for player data")
            
            // Player data is stored in the playerdata folder within each world
            val playerDataFolder = File(worldContainer, "$worldName/playerdata")
            if (playerDataFolder.exists() && playerDataFolder.isDirectory) {
                // Delete player .dat file
                if (deletePlayerData) {
                    val playerDataFile = File(playerDataFolder, "$uuidString.dat")
                    if (playerDataFile.exists() && playerDataFile.isFile) {
                        val success = playerDataFile.delete()
                        logResult("Deleted player data file", playerDataFile, success)
                    }
                }
                
                // Delete player backup .dat_old file if it exists
                if (deletePlayerBackups) {
                    val playerDataBackupFile = File(playerDataFolder, "$uuidString.dat_old")
                    if (playerDataBackupFile.exists() && playerDataBackupFile.isFile) {
                        val success = playerDataBackupFile.delete()
                        logResult("Deleted player data backup file", playerDataBackupFile, success)
                    }
                }
            }
            
            // Handle advancements (stored in advancements folder)
            if (deletePlayerAdvancements) {
                val advancementsFolder = File(worldContainer, "$worldName/advancements")
                if (advancementsFolder.exists() && advancementsFolder.isDirectory) {
                    val playerAdvancementsFile = File(advancementsFolder, "$uuidString.json")
                    if (playerAdvancementsFile.exists() && playerAdvancementsFile.isFile) {
                        val success = playerAdvancementsFile.delete()
                        logResult("Deleted player advancements file", playerAdvancementsFile, success)
                    }
                }
            }
            
            // Handle stats (stored in stats folder)
            if (deletePlayerStats) {
                val statsFolder = File(worldContainer, "$worldName/stats")
                if (statsFolder.exists() && statsFolder.isDirectory) {
                    val playerStatsFile = File(statsFolder, "$uuidString.json")
                    if (playerStatsFile.exists() && playerStatsFile.isFile) {
                        val success = playerStatsFile.delete()
                        logResult("Deleted player stats file", playerStatsFile, success)
                    }
                }
            }
        }
    }
    
    private fun logResult(action: String, file: File, success: Boolean) {
        if (debug) {
            if (success) {
                plugin.logger.info("[ForceSpawn Debug] $action: ${file.absolutePath}")
            } else {
                plugin.logger.warning("[ForceSpawn Debug] Failed to ${action.lowercase()}: ${file.absolutePath}")
            }
        } else if (!success) {
            // Always log failures, even when not in debug mode
            plugin.logger.log(Level.WARNING, "Failed to ${action.lowercase()}: ${file.absolutePath}")
        }
    }
}
