package com.bovisgl.proxy.bans.listener

import com.bovisgl.proxy.bans.config.BanConfigManager
import com.bovisgl.proxy.bans.service.BanService
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.connection.LoginEvent
import com.velocitypowered.api.event.ResultedEvent
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.time.format.DateTimeFormatter

class BanConnectionListener(
    private val banService: BanService,
    private val configManager: BanConfigManager
) {
    private val logger: Logger = LoggerFactory.getLogger(BanConnectionListener::class.java)
    
    @Subscribe
    fun onPlayerLogin(event: LoginEvent) {
        val player = event.player
        val ban = banService.checkBanOnLogin(player.uniqueId, player.username)
        
        if (ban != null && ban.isActive && !ban.isExpired()) {
            // Player is banned, deny connection
            val message = if (ban.isPermanent()) {
                formatMessage(configManager.getMessage("kick.banned-permanent"), mapOf(
                    "reason" to ban.reason,
                    "staff" to ban.bannedBy
                ))
            } else {
                formatMessage(configManager.getMessage("kick.banned-temporary"), mapOf(
                    "reason" to ban.reason,
                    "staff" to ban.bannedBy,
                    "expires" to ban.expiresAt!!.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                ))
            }
            
            event.result = ResultedEvent.ComponentResult.denied(
                Component.text(message, NamedTextColor.RED)
            )
            
            logger.info("Denied login for banned player: ${player.username} (${player.uniqueId})")
        }
    }
    
    private fun formatMessage(template: String, placeholders: Map<String, String>): String {
        var formatted = template
        placeholders.forEach { (key, value) ->
            formatted = formatted.replace("{$key}", value)
        }
        // Convert color codes and handle newlines
        return formatted.replace("&", "§").replace("\\n", "\n")
    }
}
