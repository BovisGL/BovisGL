package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.service.BanService
import com.bovisgl.proxy.bans.config.BanConfigManager
import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import java.time.format.DateTimeFormatter
import java.util.*

class BanInfoCommand(
    private val banService: BanService,
    private val configManager: BanConfigManager,
    private val proxyServer: ProxyServer
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        val args = invocation.arguments()
        
        if (!source.hasPermission("bovisgl.bans.info")) {
            source.sendMessage(Component.text(configManager.getMessage("error.no-permission"), NamedTextColor.RED))
            return
        }
        
        if (args.isEmpty()) {
            source.sendMessage(Component.text("Usage: /baninfo <player>", NamedTextColor.RED))
            return
        }
        
        val playerName = args[0]
        
        // Get player UUID
        val targetPlayer = proxyServer.getPlayer(playerName).orElse(null)
        val playerUuid = targetPlayer?.uniqueId ?: UUID.nameUUIDFromBytes(playerName.lowercase().toByteArray())
        val actualPlayerName = targetPlayer?.username ?: playerName
        
        val ban = banService.getBan(playerUuid)
        
        if (ban == null || !ban.isActive) {
            source.sendMessage(Component.text("$actualPlayerName is not banned.", NamedTextColor.GREEN))
            return
        }
        
        val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
        
        source.sendMessage(Component.text("=== Ban Info for $actualPlayerName ===", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("Reason: ${ban.reason}", NamedTextColor.GRAY))
        source.sendMessage(Component.text("Banned by: ${ban.bannedBy}", NamedTextColor.GRAY))
        source.sendMessage(Component.text("Banned at: ${ban.bannedAt.format(formatter)}", NamedTextColor.GRAY))
        
        if (ban.isPermanent()) {
            source.sendMessage(Component.text("Duration: Permanent", NamedTextColor.RED))
        } else {
            source.sendMessage(Component.text("Expires: ${ban.expiresAt!!.format(formatter)}", NamedTextColor.GRAY))
            val remaining = ban.getRemainingDuration()
            if (remaining != null && remaining > 0) {
                source.sendMessage(Component.text("Time remaining: $remaining minutes", NamedTextColor.GRAY))
            }
        }
    }
}
