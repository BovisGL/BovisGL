package com.bovisgl.hub

import com.bovisgl.hub.forcespawn.ForceSpawnManager
import com.bovisgl.hub.spawn.CustomSpawnManager
import com.bovisgl.hub.tracking.ServerOriginTracker
import com.bovisgl.hub.monitoring.HubMonitoringService
import org.bukkit.plugin.java.JavaPlugin
import org.bukkit.configuration.file.FileConfiguration
import org.bukkit.command.Command
import org.bukkit.command.CommandSender
import org.bukkit.event.Listener
import org.bukkit.event.EventHandler
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerQuitEvent
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import com.google.gson.Gson
import java.util.logging.Level
import net.kyori.adventure.text.Component

/**
 * BovisGL Hub Plugin - Main plugin for Paper servers in the BovisGL network
 * 
 * This plugin combines functionality from:
 * - ForceSpawn: Forces players to respawn at spawn point
 * - CustomSpawn: Server-specific spawn points based on origin
 * - ServerOriginTracker: Tracks which server players came from
 * - Hub-specific features for the BovisGL network
 */
class BovisGLHubPlugin : JavaPlugin() {
    
    private var forceSpawnManager: ForceSpawnManager? = null
    lateinit var customSpawnManager: CustomSpawnManager
        private set
    private var serverOriginTracker: ServerOriginTracker? = null
    private var monitoringService: HubMonitoringService? = null
    private var chatGuiListener: ChatGuiListener? = null
    private val gson = Gson()
    private val communicationsBase = System.getProperty("bovisgl.communications.base", "http://127.0.0.1:3456")
    
    override fun onEnable() {
        // Save default config if it doesn't exist
        saveDefaultConfig()
        loadConfiguration()
        
        logger.info("Starting BovisGL Hub Plugin...")
        
        // Initialize ForceSpawn functionality
        try {
            forceSpawnManager = ForceSpawnManager(this)
            forceSpawnManager?.initialize()
            logger.info("ForceSpawn module initialized successfully")
        } catch (e: Exception) {
            logger.log(Level.SEVERE, "Failed to initialize ForceSpawn module: ${e.message}", e)
        }
        
        // Initialize Custom Spawn system
        try {
            customSpawnManager = CustomSpawnManager(this)
            customSpawnManager.initialize()
            logger.info("Custom Spawn system initialized successfully")
        } catch (e: Exception) {
            logger.log(Level.SEVERE, "Failed to initialize Custom Spawn system: ${e.message}", e)
        }

    // Chat GUI listener registration removed to disable the custom double-tap chat UI
    // chatGuiListener = ChatGuiListener(this)
    // server.pluginManager.registerEvents(chatGuiListener!!, this)
        
        // Initialize Server Origin Tracker
        try {
            serverOriginTracker = ServerOriginTracker(this)
            serverOriginTracker?.initialize()
            logger.info("Server Origin Tracker initialized successfully")
        } catch (e: Exception) {
            logger.log(Level.SEVERE, "Failed to initialize Server Origin Tracker: ${e.message}", e)
        }

        
        // Initialize monitoring service for web dashboard
        try {
            monitoringService = HubMonitoringService(this)
            monitoringService?.start()
            logger.info("Monitoring service initialized successfully")
        } catch (e: Exception) {
            logger.log(Level.SEVERE, "Failed to initialize monitoring service: ${e.message}", e)
        }
        
        // Register vanilla ban command blocker (still block commands in-game)
        try {
            val vanillaBanBlocker = VanillaBanCommandBlocker()
            server.pluginManager.registerEvents(vanillaBanBlocker, this)
            logger.info("Vanilla Ban Command Blocker registered successfully")
        } catch (e: Exception) {
            logger.log(Level.SEVERE, "Failed to register Vanilla Ban Command Blocker: ${e.message}", e)
        }
        
        logger.info("BovisGL Hub Plugin has been enabled!")
    }
    
    override fun onDisable() {
        // Cleanup monitoring service
        monitoringService?.stop()
        
        // Cleanup ForceSpawn
        forceSpawnManager?.shutdown()
        
        logger.info("BovisGL Hub Plugin has been disabled!")
    }
    
    private fun loadConfiguration() {
        // Set default values if not present
        config.addDefault("forcespawn.enabled", true)
        config.addDefault("forcespawn.delete-player-data", true)
        config.addDefault("forcespawn.delete-player-advancements", false)
        config.addDefault("forcespawn.delete-player-stats", false)
        config.addDefault("forcespawn.delete-player-backups", true)
        config.addDefault("forcespawn.deletion-delay", 2)
        config.addDefault("forcespawn.debug", false)
        config.addDefault(
            "forcespawn.join-message",
            "&6Welcome to BovisGL, %name%! &7You can explore the hub or go through the lava portal to head to Anarchy. Use &e/discord &7for an invite and visit &ehttps://bovisgl.xyz &7for updates and more. Please read the rules on the big welcome board before playing."
        )
        config.addDefault("forcespawn.force-teleport-on-join", false)
        
        config.addDefault("hub.server-name", "BovisGL Hub")
        config.addDefault("hub.cross-server-enabled", true)
        config.addDefault("hub.world.enable-hub-command", true)
        config.addDefault("hub.world.enable-server-commands", true)
        config.addDefault("hub.world.command-cooldown", 3)
        
        // Custom spawn settings
        config.addDefault("customspawn.enabled", true)
        config.addDefault("customspawn.welcome-message-enabled", true)
        config.addDefault("customspawn.track-origins", true)
        
        config.options().copyDefaults(true)
        saveConfig()
    }
    
    override fun onCommand(sender: CommandSender, command: Command, label: String, args: Array<String>): Boolean {
        if (command.name.equals("bovisgl-hub", ignoreCase = true)) {
            if (args.size == 1 && args[0].equals("reload", ignoreCase = true)) {
                if (!sender.hasPermission("bovisgl.admin.reload")) {
                    sender.sendMessage(net.kyori.adventure.text.Component.text("§cYou don't have permission to use this command."))
                    return true
                }
                
                reloadConfig()
                loadConfiguration()
                
                // Reload modules
                forceSpawnManager?.reload()
                
                sender.sendMessage(net.kyori.adventure.text.Component.text("§aBovisGL Hub Plugin configuration reloaded!"))
                return true
            }
        }
        
        // Delegate to ForceSpawn module
        if (forceSpawnManager?.handleCommand(sender, command, label, args) == true) {
            return true
        }
        
        // Ban commands removed - banning is handled only via web interface
        // No /ban, /unban, or other ban commands
        return false
    }
    
    /**
     * Get the ForceSpawn manager
     */
    fun getForceSpawnManager(): ForceSpawnManager? = forceSpawnManager
}
