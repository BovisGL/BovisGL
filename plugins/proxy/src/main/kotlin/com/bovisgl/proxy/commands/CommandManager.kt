package com.bovisgl.proxy.commands

import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import org.slf4j.Logger
import java.io.File

/**
 * Command Manager - Handles registration of all server connection commands
 */
class CommandManager(
    private val server: ProxyServer,
    private val logger: Logger
) {
    
    fun registerCommands() {
        try {
            logger.info("Registering server connection commands...")
            
            // Register hub command
            val hubCommand = HubCommand(server)
            server.commandManager.register("hub", hubCommand)
            logger.info("Registered /hub command")
            
            // Register help command
            val helpCommand = HelpCommand(server)
            server.commandManager.register("help", helpCommand)
            logger.info("Registered /help command")
            
            // Register server-specific commands based on the network configuration
            registerServerCommand("anarchy", "Anarchy Server", arrayOf("an"))
            registerServerCommand("civilization", "Civilization Server", arrayOf("civ"))
            registerServerCommand("arena", "Arena Server", arrayOf("pvp"))
            // Parkour command with several typo-friendly aliases per request
            registerServerCommand("parkour", "Parkour Server", arrayOf(
                "pk",
                // Common typos requested
                "apkrou", "apkrour", "pakrour", "parkoru"
            ))

            // Ban/unban commands disabled - use web interface instead
            // server.commandManager.register("ban", BanCommand(logger))
            // server.commandManager.register("unban", UnbanCommand(logger))
            // logger.info("Registered /ban and /unban commands (centralized communications ban system)")
            logger.info("Ban commands disabled - use web interface for ban management")

            logger.info("Server connection and moderation commands registered successfully (status via '<server> status')")
            
        } catch (e: Exception) {
            logger.error("Failed to register server connection commands", e)
        }
    }
    
    private fun registerServerCommand(serverName: String, displayName: String, aliases: Array<String>) {
        try {
            val command = ServerCommand(server, serverName, displayName)
            
            // Register main command
            server.commandManager.register(serverName, command)
            logger.info("Registered /$serverName command")
            
            // Register aliases
            for (alias in aliases) {
                server.commandManager.register(alias, command)
                logger.info("Registered /$alias alias for $serverName")
            }
            
        } catch (e: Exception) {
            logger.error("Failed to register command for server: $serverName", e)
        }
    }
}
