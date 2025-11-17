package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.service.BanService
import com.bovisgl.proxy.bans.config.BanConfigManager
import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import java.util.*

class PardonCommand(
    private val banService: BanService,
    private val configManager: BanConfigManager,
    private val proxyServer: ProxyServer
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        val args = invocation.arguments()
        
        if (!source.hasPermission("bovisgl.bans.pardon")) {
            source.sendMessage(Component.text(configManager.getMessage("error.no-permission"), NamedTextColor.RED))
            return
        }
        
        if (args.isEmpty()) {
            source.sendMessage(Component.text("Usage: /pardon <player>", NamedTextColor.RED))
            return
        }
        
        val playerName = args[0]
        
        // Get player UUID
        val targetPlayer = proxyServer.getPlayer(playerName).orElse(null)
        val playerUuid = targetPlayer?.uniqueId ?: UUID.nameUUIDFromBytes(playerName.lowercase().toByteArray())
        val actualPlayerName = targetPlayer?.username ?: playerName
        
        val staffName = if (source is com.velocitypowered.api.proxy.Player) {
            source.username
        } else {
            "Console"
        }
        
        // Unban the player
        val success = banService.unbanPlayer(playerUuid, actualPlayerName, staffName)
        
        if (success) {
            source.sendMessage(Component.text(
                "Successfully unbanned $actualPlayerName", 
                NamedTextColor.GREEN
            ))
        } else {
            source.sendMessage(Component.text("$actualPlayerName is not banned!", NamedTextColor.RED))
        }
    }
    
    override fun suggest(invocation: SimpleCommand.Invocation): List<String> {
        val args = invocation.arguments()
        
        return when (args.size) {
            1 -> {
                // Suggest banned player names (would need to implement this)
                val input = args[0].lowercase()
                banService.getAllActiveBans()
                    .map { it.playerName }
                    .filter { it.lowercase().startsWith(input) }
            }
            else -> emptyList()
        }
    }
}
