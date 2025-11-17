package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.service.BanService
import com.bovisgl.proxy.bans.config.BanConfigManager
import com.velocitypowered.api.command.SimpleCommand
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

class BanListCommand(
    private val banService: BanService,
    private val configManager: BanConfigManager
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        
        if (!source.hasPermission("bovisgl.bans.list")) {
            source.sendMessage(Component.text(configManager.getMessage("error.no-permission"), NamedTextColor.RED))
            return
        }
        
        val activeBans = banService.getAllActiveBans()
        
        if (activeBans.isEmpty()) {
            source.sendMessage(Component.text("No active bans found.", NamedTextColor.GREEN))
            return
        }
        
        source.sendMessage(Component.text("=== Active Bans (${activeBans.size}) ===", NamedTextColor.YELLOW))
        
        activeBans.forEachIndexed { index, ban ->
            val expiry = if (ban.isPermanent()) "Permanent" else ban.getFormattedExpiry()
            val message = "${index + 1}. ${ban.playerName} - ${ban.reason} (by ${ban.bannedBy}) - $expiry"
            source.sendMessage(Component.text(message, NamedTextColor.GRAY))
        }
    }
}
