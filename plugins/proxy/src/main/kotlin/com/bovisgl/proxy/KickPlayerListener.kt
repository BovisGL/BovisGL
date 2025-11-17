package com.bovisgl.proxy

import com.velocitypowered.api.proxy.ProxyServer
import net.kyori.adventure.text.Component
import org.slf4j.Logger
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Handles player kick commands from the communications service
 */
class KickPlayerListener(private val proxyServer: ProxyServer, private val logger: Logger) {
    private val pendingKicks = ConcurrentHashMap<String, String>()

    fun initializeRoutes() {
        // Route registered via the proxy plugin's HTTP server
        // This is called by communications service when a player is banned
    }

    fun kickPlayer(uuid: String, reason: String) {
        try {
            val player = proxyServer.getPlayer(UUID.fromString(uuid)).orElse(null)
            if (player != null) {
                logger.warn("🚫 Kicking banned player: ${player.username} ($uuid)")
                player.disconnect(Component.text("§cYou have been banned from this server.\n§7Reason: $reason"))
                pendingKicks.remove(uuid)
            } else {
                logger.debug("Player $uuid not currently online for kick")
            }
        } catch (e: Exception) {
            logger.error("Failed to kick player $uuid: ${e.message}", e)
        }
    }
}
