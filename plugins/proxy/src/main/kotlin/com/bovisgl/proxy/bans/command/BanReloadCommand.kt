package com.bovisgl.proxy.bans.command

import com.bovisgl.proxy.bans.config.BanConfigManager
import com.velocitypowered.api.command.SimpleCommand
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

class BanReloadCommand(
    private val configManager: BanConfigManager
) : SimpleCommand {
    
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        
        if (!source.hasPermission("bovisgl.bans.reload")) {
            source.sendMessage(Component.text(configManager.getMessage("error.no-permission"), NamedTextColor.RED))
            return
        }
        
        try {
            configManager.reload()
            source.sendMessage(Component.text("Ban configuration reloaded successfully!", NamedTextColor.GREEN))
        } catch (e: Exception) {
            source.sendMessage(Component.text("Failed to reload ban configuration: ${e.message}", NamedTextColor.RED))
        }
    }
}
