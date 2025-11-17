package com.bovisgl.proxy.commands

import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.Player
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

/**
 * Server connection command - connects players to specified servers
 */
class ServerCommand(
    private val proxyServer: ProxyServer,
    private val serverName: String,
    private val displayName: String,
    private val baseStatusUrl: String = (System.getenv("BOVISGL_COMMS") ?: "http://localhost:3456")
) : SimpleCommand {
    // Removed online status subcommand and related HTTP client as online state is now handled via communications backend and RCON
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        val args = invocation.arguments()

        // 'status' subcommand removed; this command now only handles connecting the player to the target server.

        // Only players can use connection behavior
        if (source !is Player) {
            source.sendMessage(Component.text("Only players can use this command!", NamedTextColor.RED))
            return
        }
        val player = source as Player

        val currentServer = player.currentServer.orElse(null)
        if (currentServer?.serverInfo?.name?.equals(serverName, ignoreCase = true) == true) {
            player.sendMessage(Component.text("You are already connected to $displayName!", NamedTextColor.YELLOW))
            return
        }
        val targetServer = proxyServer.getServer(serverName).orElse(null)
        if (targetServer == null) {
            player.sendMessage(Component.text("$displayName server is not available!", NamedTextColor.RED))
            return
        }
        player.sendMessage(Component.text("Connecting to $displayName...", NamedTextColor.GREEN))
        player.createConnectionRequest(targetServer).connect().thenAccept { result ->
            if (!result.isSuccessful) {
                val reason = result.reasonComponent.orElse(Component.text("Unknown error"))
                player.sendMessage(Component.text("Failed to connect to $displayName: ").append(reason))
            }
        }
    }
}
