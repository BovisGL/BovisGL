package com.bovisgl.hub

import org.bukkit.event.EventHandler
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerCommandPreprocessEvent
import org.bukkit.event.server.ServerCommandEvent
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

/**
 * VanillaBanCommandBlocker - Blocks all vanilla ban system commands
 * Disabled commands: /ban, /unban, /banlist, /pardon, /pardon-ip, /ban-ip
 */
class VanillaBanCommandBlocker : Listener {

    @EventHandler
    fun onPlayerCommand(event: PlayerCommandPreprocessEvent) {
        val cmd = event.message.lowercase().trim()
        
        // Block vanilla ban commands
        if (cmd.startsWith("/ban ") || cmd == "/ban" ||
            cmd.startsWith("/unban ") || cmd == "/unban" ||
            cmd.startsWith("/banlist") || cmd == "/banlist" ||
            cmd.startsWith("/pardon ") || cmd == "/pardon" ||
            cmd.startsWith("/pardon-ip ") || cmd == "/pardon-ip" ||
            cmd.startsWith("/ban-ip ") || cmd == "/ban-ip") {
            
            event.isCancelled = true
            event.player.sendMessage(Component.text("Ban commands are disabled. Use the web interface for ban management.", NamedTextColor.RED))
        }
    }

    @EventHandler
    fun onServerCommand(event: ServerCommandEvent) {
        val cmd = event.command.lowercase().trim()
        
        // Block vanilla ban commands from console
        if (cmd.startsWith("ban ") || cmd == "ban" ||
            cmd.startsWith("unban ") || cmd == "unban" ||
            cmd.startsWith("banlist") || cmd == "banlist" ||
            cmd.startsWith("pardon ") || cmd == "pardon" ||
            cmd.startsWith("pardon-ip ") || cmd == "pardon-ip" ||
            cmd.startsWith("ban-ip ") || cmd == "ban-ip") {
            
            event.isCancelled = true
        }
    }
}
