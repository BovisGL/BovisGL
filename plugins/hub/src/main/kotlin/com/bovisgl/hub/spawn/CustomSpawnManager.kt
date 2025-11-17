package com.bovisgl.hub.spawn

import com.bovisgl.hub.BovisGLHubPlugin
import org.bukkit.Location
import org.bukkit.command.Command
import org.bukkit.command.CommandExecutor
import org.bukkit.command.CommandSender
import org.bukkit.command.TabCompleter
import org.bukkit.entity.Player
import org.bukkit.configuration.file.YamlConfiguration
import java.io.File

/**
 * Custom Spawn Manager - Handles server-specific spawn points
 * Teleports players to different spawn points based on which server they came from
 */
class CustomSpawnManager(private val plugin: BovisGLHubPlugin) : CommandExecutor, TabCompleter {
    
    private val spawnConfig: YamlConfiguration
    private val spawnFile: File
    private val spawns = mutableMapOf<String, Location>()
    
    init {
        spawnFile = File(plugin.dataFolder, "custom-spawns.yml")
        if (!spawnFile.exists()) {
            spawnFile.parentFile?.mkdirs()
            spawnFile.createNewFile()
        }
        spawnConfig = YamlConfiguration.loadConfiguration(spawnFile)
        loadSpawns()
    }
    
    fun initialize() {
        plugin.getCommand("customspawn")?.setExecutor(this)
        plugin.getCommand("customspawn")?.tabCompleter = this
        
        plugin.logger.info("Custom Spawn Manager initialized with ${spawns.size} spawn points")
    }
    
    private fun loadSpawns() {
        spawns.clear()
        
        for (spawnName in spawnConfig.getKeys(false)) {
            try {
                val location = spawnConfig.getLocation(spawnName)
                if (location != null) {
                    spawns[spawnName] = location
                    plugin.logger.info("Loaded spawn point: $spawnName")
                }
            } catch (e: Exception) {
                plugin.logger.warning("Failed to load spawn point $spawnName: ${e.message}")
            }
        }
    }
    
    private fun saveSpawns() {
        for ((name, location) in spawns) {
            spawnConfig.set(name, location)
        }
        
        try {
            spawnConfig.save(spawnFile)
        } catch (e: Exception) {
            plugin.logger.severe("Failed to save spawn configuration: ${e.message}")
        }
    }
    
    /**
     * Get the appropriate spawn point for a player based on where they came from
     */
    fun getSpawnForServer(fromServer: String?): Location? {
        return when (fromServer?.lowercase()) {
            "anarchy" -> spawns["anarchy"] ?: spawns["default"]
            "civilization" -> spawns["civilization"] ?: spawns["default"]
            "arena" -> spawns["arena"] ?: spawns["default"]
            "parkour" -> spawns["parkour"] ?: spawns["default"]
            else -> spawns["default"]
        }
    }
    
    /**
     * Teleport player to appropriate spawn based on their previous server
     */
    fun teleportToSpawn(player: Player, fromServer: String?) {
        val spawnLocation = getSpawnForServer(fromServer)
        
        if (spawnLocation != null) {
            player.teleport(spawnLocation)
            
            // Simple welcome message when coming from another server
            if (fromServer != null && fromServer.lowercase() != "hub") {
                player.sendMessage("§aWelcome back to the hub!")
            }
            
            plugin.logger.info("Teleported ${player.name} to ${fromServer ?: "default"} spawn")
        } else {
            // Fallback to world spawn
            player.teleport(player.world.spawnLocation)
            plugin.logger.warning("No spawn point found for ${fromServer ?: "default"}, using world spawn")
        }
    }
    
    override fun onCommand(sender: CommandSender, command: Command, label: String, args: Array<String>): Boolean {
        if (command.name.equals("customspawn", ignoreCase = true)) {
            if (!sender.hasPermission("bovisgl.customspawn.admin")) {
                sender.sendMessage("§cYou don't have permission to use this command!")
                return true
            }
            
            when (args.getOrNull(0)?.lowercase()) {
                "set" -> {
                    if (sender !is Player) {
                        sender.sendMessage("§cOnly players can set spawn points!")
                        return true
                    }
                    
                    if (args.size < 2) {
                        sender.sendMessage("§cUsage: /customspawn set <spawn_name>")
                        return true
                    }
                    
                    val spawnName = args[1].lowercase()
                    spawns[spawnName] = sender.location.clone()
                    saveSpawns()
                    
                    sender.sendMessage("§aSpawn point '$spawnName' set at your current location!")
                    plugin.logger.info("${sender.name} set spawn point: $spawnName")
                }
                
                "remove" -> {
                    if (args.size < 2) {
                        sender.sendMessage("§cUsage: /customspawn remove <spawn_name>")
                        return true
                    }
                    
                    val spawnName = args[1].lowercase()
                    if (spawns.remove(spawnName) != null) {
                        saveSpawns()
                        sender.sendMessage("§aSpawn point '$spawnName' removed!")
                        plugin.logger.info("${sender.name} removed spawn point: $spawnName")
                    } else {
                        sender.sendMessage("§cSpawn point '$spawnName' not found!")
                    }
                }
                
                "list" -> {
                    if (spawns.isEmpty()) {
                        sender.sendMessage("§cNo custom spawn points are set!")
                        return true
                    }
                    
                    sender.sendMessage("§6=== Custom Spawn Points ===")
                    for ((name, location) in spawns) {
                        sender.sendMessage("§e$name: §f${location.world?.name} (${location.blockX}, ${location.blockY}, ${location.blockZ})")
                    }
                }
                
                "tp" -> {
                    if (sender !is Player) {
                        sender.sendMessage("§cOnly players can teleport!")
                        return true
                    }
                    
                    if (args.size < 2) {
                        sender.sendMessage("§cUsage: /customspawn tp <spawn_name>")
                        return true
                    }
                    
                    val spawnName = args[1].lowercase()
                    val spawnLocation = spawns[spawnName]
                    
                    if (spawnLocation != null) {
                        sender.teleport(spawnLocation)
                        sender.sendMessage("§aTeleported to spawn point '$spawnName'!")
                    } else {
                        sender.sendMessage("§cSpawn point '$spawnName' not found!")
                    }
                }
                
                "reload" -> {
                    loadSpawns()
                    sender.sendMessage("§aCustom spawn configuration reloaded! (${spawns.size} spawn points)")
                }
                
                else -> {
                    sender.sendMessage("§6=== Custom Spawn Commands ===")
                    sender.sendMessage("§e/customspawn set <name> §7- Set spawn point at your location")
                    sender.sendMessage("§e/customspawn remove <name> §7- Remove a spawn point")
                    sender.sendMessage("§e/customspawn list §7- List all spawn points")
                    sender.sendMessage("§e/customspawn tp <name> §7- Teleport to a spawn point")
                    sender.sendMessage("§e/customspawn reload §7- Reload configuration")
                    sender.sendMessage("§7")
                    sender.sendMessage("§7Supported spawn names: default, anarchy, civilization, arena, parkour")
                }
            }
            
            return true
        }
        
        return false
    }
    
    override fun onTabComplete(sender: CommandSender, command: Command, alias: String, args: Array<String>): List<String> {
        if (command.name.equals("customspawn", ignoreCase = true)) {
            when (args.size) {
                1 -> return listOf("set", "remove", "list", "tp", "reload").filter { 
                    it.startsWith(args[0], ignoreCase = true) 
                }
                2 -> {
                    when (args[0].lowercase()) {
                        "set" -> return listOf("default", "anarchy", "civilization", "arena", "parkour").filter {
                            it.startsWith(args[1], ignoreCase = true)
                        }
                        "remove", "tp" -> return spawns.keys.filter {
                            it.startsWith(args[1], ignoreCase = true)
                        }
                    }
                }
            }
        }
        return emptyList()
    }
}
