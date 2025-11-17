package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.config.BanConfigManager
import com.velocitypowered.api.command.SimpleCommand
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

class BanHelpCommand(
    private val configManager: BanConfigManager
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        
        source.sendMessage(Component.text("=== BovisGL Ban System Help ===", NamedTextColor.GOLD))
        source.sendMessage(Component.text("/ban <player> <reason> [duration] - Ban a player", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("/pardon <player> - Unban a player", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("/banlist - List all active bans", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("/baninfo <player> - Get ban information", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("/banhistory <player> - View ban history", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("/banreload - Reload ban configuration", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("/banhelp - Show this help message", NamedTextColor.YELLOW))
        source.sendMessage(Component.text("", NamedTextColor.WHITE))
        source.sendMessage(Component.text("Duration examples: 1h, 30m, 7d, 1w", NamedTextColor.GRAY))
        source.sendMessage(Component.text("No duration = permanent ban", NamedTextColor.GRAY))
    }
}
