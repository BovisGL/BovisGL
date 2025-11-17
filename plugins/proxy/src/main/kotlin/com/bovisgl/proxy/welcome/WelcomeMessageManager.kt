package com.bovisgl.proxy.welcome

import com.bovisgl.proxy.client.ClientDetectListener
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.connection.PostLoginEvent
import com.velocitypowered.api.proxy.Player
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import net.kyori.adventure.text.minimessage.MiniMessage
import org.slf4j.Logger
import java.util.concurrent.CompletableFuture

/**
 * Welcome Message Manager - Handles welcome messages for new and returning players
 */
class WelcomeMessageManager(
    private val logger: Logger,
    private val clientDetectListener: ClientDetectListener
) {
    
    private val miniMessage = MiniMessage.miniMessage()
    
    @Subscribe
    fun onPlayerJoin(event: PostLoginEvent) {
        val player = event.player
        
        CompletableFuture.runAsync {
            try {
                sendWelcomeMessage(player)
            } catch (e: Exception) {
                logger.error("Error sending welcome message to ${player.username}", e)
            }
        }
    }
    
    private fun sendWelcomeMessage(player: Player) {
        val username = player.username
        val uuid = player.uniqueId
        
        // Main welcome message with username
        val welcomeMessage = Component.text()
            .append(Component.text("Welcome to BovisGL, ", NamedTextColor.GRAY))
            .append(Component.text(username, NamedTextColor.AQUA))
            .append(Component.text("! You can explore the hub or go through the lava portal to head to Anarchy.", NamedTextColor.GRAY))
            .build()
        
        player.sendMessage(welcomeMessage)
        
        // Additional help messages
        player.sendMessage(Component.text("Use /hub to return to the hub", NamedTextColor.GRAY))
        
        // Check if client is older than 1.21.9 and add deprecation warning
        // Only show warning to Java players (not Bedrock)
        val clientToken = clientDetectListener.currentClientToken(uuid)
        if (clientToken != null && clientToken.startsWith("java.") && isOldClient(clientToken)) {
            val deprecatedWarning = Component.text()
                .append(Component.text("Note: Your Java client is older than 1.21.9 and may be buggy. Please try upgrading to 1.21.9+ before reporting bugs.", NamedTextColor.RED))
                .build()
            player.sendMessage(deprecatedWarning)
        }
    }
    
    /**
     * Check if client version is older than 1.21.9
     * Compares based on the client token format: "java.X.Y.Z"
     */
    private fun isOldClient(clientToken: String): Boolean {
        // Extract version from token like "java.1.21.7-1.21.8" or "java.1.21.9-1.21.10"
        val versionPart = clientToken.substringAfter("java.").takeWhile { it != '-' }
        
        // Parse version to compare with 1.21.9
        val parts = versionPart.split(".")
        if (parts.size < 3) return true // Assume old if we can't parse
        
        val major = parts.getOrNull(0)?.toIntOrNull() ?: return true
        val minor = parts.getOrNull(1)?.toIntOrNull() ?: return true
        val patch = parts.getOrNull(2)?.toIntOrNull() ?: return true
        
        // Compare: if not 1.21.9 or higher, it's old
        if (major > 1) return false
        if (major < 1) return true
        if (minor > 21) return false
        if (minor < 21) return true
        
        // At this point: major == 1 && minor == 21
        return patch < 9
    }
}
