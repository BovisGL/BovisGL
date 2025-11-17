package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.service.BanService
import com.bovisgl.proxy.bans.config.BanConfigManager
import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import java.time.format.DateTimeFormatter
import java.util.*

class BanHistoryCommand(
    private val banService: BanService,
    private val configManager: BanConfigManager,
    private val proxyServer: ProxyServer
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        val args = invocation.arguments()
        
        if (!source.hasPermission("bovisgl.bans.history")) {
            source.sendMessage(Component.text(configManager.getMessage("error.no-permission"), NamedTextColor.RED))
            return
        }
        
        if (args.isEmpty()) {
            source.sendMessage(Component.text("Usage: /banhistory <player>", NamedTextColor.RED))
            return
        }
        
        val playerName = args[0]
        
        // Get player UUID
        val targetPlayer = proxyServer.getPlayer(playerName).orElse(null)
        val playerUuid = targetPlayer?.uniqueId ?: UUID.nameUUIDFromBytes(playerName.lowercase().toByteArray())
        val actualPlayerName = targetPlayer?.username ?: playerName
        
        val history = banService.getBanHistory(playerUuid)
        
        if (history.isEmpty()) {
            source.sendMessage(Component.text("No ban history found for $actualPlayerName.", NamedTextColor.GREEN))
            return
        }
        
        val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
        
        source.sendMessage(Component.text("=== Ban History for $actualPlayerName (${history.size} entries) ===", NamedTextColor.YELLOW))
        
        history.forEachIndexed { index, entry ->
            val color = when (entry.actionType) {
                "BAN" -> NamedTextColor.RED
                "UNBAN" -> NamedTextColor.GREEN
                else -> NamedTextColor.GRAY
            }
            
            val reasonText = entry.reason?.let { " - $it" } ?: ""
            val message = "${index + 1}. ${entry.actionType} by ${entry.performedBy} at ${entry.performedAt.format(formatter)}$reasonText"
            source.sendMessage(Component.text(message, color))
        }
    }
}
