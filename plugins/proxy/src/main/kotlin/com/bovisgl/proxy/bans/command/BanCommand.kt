package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.service.BanService
import com.bovisgl.proxy.bans.config.BanConfigManager
import com.bovisgl.proxy.bans.util.DurationParser
import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import java.util.*

class BanCommand(
    private val banService: BanService,
    private val configManager: BanConfigManager,
    private val proxyServer: ProxyServer
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        val args = invocation.arguments()
        
        if (!source.hasPermission("bovisgl.bans.ban")) {
            source.sendMessage(Component.text(configManager.getMessage("error.no-permission"), NamedTextColor.RED))
            return
        }
        
        if (args.size < 2) {
            source.sendMessage(Component.text("Usage: /ban <player> <reason> [duration]", NamedTextColor.RED))
            return
        }
        
        val playerName = args[0]
        val reasonParts = args.drop(1).toMutableList()
        var duration: String? = null
        
        // Check if last argument is a duration
        if (reasonParts.isNotEmpty()) {
            val lastArg = reasonParts.last()
            if (DurationParser.isDuration(lastArg)) {
                duration = lastArg
                reasonParts.removeAt(reasonParts.size - 1)
            }
        }
        
        val reason = reasonParts.joinToString(" ")
        if (reason.isBlank()) {
            source.sendMessage(Component.text("Please provide a ban reason!", NamedTextColor.RED))
            return
        }
        
        // Get player UUID (check online players first, then use name)
        val targetPlayer = proxyServer.getPlayer(playerName).orElse(null)
        val playerUuid = targetPlayer?.uniqueId ?: UUID.nameUUIDFromBytes(playerName.lowercase().toByteArray())
        val actualPlayerName = targetPlayer?.username ?: playerName
        
        val staffName = if (source is com.velocitypowered.api.proxy.Player) {
            source.username
        } else {
            "Console"
        }
        
        // Parse duration if provided
        val expiresAt = duration?.let { DurationParser.parseDuration(it) }
        
        // Ban the player
        val success = banService.banPlayer(playerUuid, actualPlayerName, staffName, reason, expiresAt)
        
        if (success) {
            val durationType = if (expiresAt == null) "permanently" else "temporarily"
            source.sendMessage(Component.text(
                "Successfully banned $actualPlayerName $durationType for: $reason", 
                NamedTextColor.GREEN
            ))
        } else {
            val ban = banService.getBan(playerUuid)
            if (ban != null) {
                source.sendMessage(Component.text("$actualPlayerName is already banned!", NamedTextColor.RED))
            } else {
                source.sendMessage(Component.text("Failed to ban $actualPlayerName!", NamedTextColor.RED))
            }
        }
    }
    
    override fun suggest(invocation: SimpleCommand.Invocation): List<String> {
        val args = invocation.arguments()
        
        return when (args.size) {
            1 -> {
                // Suggest online player names
                val input = args[0].lowercase()
                proxyServer.allPlayers
                    .map { it.username }
                    .filter { it.lowercase().startsWith(input) }
            }
            else -> emptyList()
        }
    }
}
