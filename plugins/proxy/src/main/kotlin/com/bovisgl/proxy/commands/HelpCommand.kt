package com.bovisgl.proxy.commands

import com.velocitypowered.api.command.SimpleCommand
import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import net.kyori.adventure.text.format.TextDecoration

class HelpCommand(private val server: ProxyServer) : SimpleCommand {
    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        
        val prefix = Component.text("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", NamedTextColor.GRAY)
        val title = Component.text("BovisGL Commands", NamedTextColor.AQUA, TextDecoration.BOLD)
        val divider = Component.text("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", NamedTextColor.GRAY)
        
        source.sendMessage(prefix)
        source.sendMessage(title)
        source.sendMessage(divider)
        
        // Server navigation
        source.sendMessage(Component.text("  ").append(Component.text("/hub", NamedTextColor.YELLOW)).append(Component.text(" - Go to the hub", NamedTextColor.GRAY)))
        source.sendMessage(Component.text("  ").append(Component.text("/anarchy", NamedTextColor.YELLOW)).append(Component.text(" (or /an) - Go to Anarchy", NamedTextColor.GRAY)))
        source.sendMessage(Component.text("  ").append(Component.text("/civilization", NamedTextColor.YELLOW)).append(Component.text(" (or /civ) - Go to Civilization", NamedTextColor.GRAY)))
        source.sendMessage(Component.text("  ").append(Component.text("/arena", NamedTextColor.YELLOW)).append(Component.text(" (or /pvp) - Go to Arena", NamedTextColor.GRAY)))
        source.sendMessage(Component.text("  ").append(Component.text("/parkour", NamedTextColor.YELLOW)).append(Component.text(" (or /pk) - Go to Parkour", NamedTextColor.GRAY)))
        
        source.sendMessage(Component.empty())
        
        // Server status
        source.sendMessage(Component.text("  ").append(Component.text("/<server> status", NamedTextColor.YELLOW)).append(Component.text(" - Check server status", NamedTextColor.GRAY)))
        
        source.sendMessage(Component.empty())
        
        // Help
        source.sendMessage(Component.text("  ").append(Component.text("/help", NamedTextColor.YELLOW)).append(Component.text(" - Show this help message", NamedTextColor.GRAY)))
        
        source.sendMessage(divider)
    }
}
