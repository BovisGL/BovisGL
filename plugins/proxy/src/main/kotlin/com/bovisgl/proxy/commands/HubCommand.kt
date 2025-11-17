package com.bovisgl.proxy.commands

import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.Player
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

/**
 * Hub command - connects players to the hub server
 */
class HubCommand(
    private val proxyServer: ProxyServer
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        
        // Only players can use this command
        if (source !is Player) {
            source.sendMessage(Component.text("Only players can use this command!", NamedTextColor.RED))
            return
        }
        
        val player = source as Player
        
        // Check if player is already on hub
        val currentServer = player.currentServer.orElse(null)
        if (currentServer?.serverInfo?.name?.equals("hub", ignoreCase = true) == true) {
            player.sendMessage(Component.text("You are already connected to the hub!", NamedTextColor.YELLOW))
            return
        }
        
        // Find hub server
        val hubServer = proxyServer.getServer("hub").orElse(null)
        if (hubServer == null) {
            player.sendMessage(Component.text("Hub server is not available!", NamedTextColor.RED))
            return
        }
        
        // Connect to hub
        player.sendMessage(Component.text("Connecting to hub...", NamedTextColor.GREEN))
        player.createConnectionRequest(hubServer).connect().thenAccept { result ->
            if (!result.isSuccessful) {
                val reason = result.reasonComponent.orElse(Component.text("Unknown error"))
                player.sendMessage(Component.text("Failed to connect to hub: ").append(reason))
            }
        }
    }
}
