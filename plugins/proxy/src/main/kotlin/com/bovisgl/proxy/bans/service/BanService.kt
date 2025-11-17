package com.bovisgl.proxy.bans.service

import com.bovisgl.proxy.bans.config.BanConfigManager
import com.bovisgl.proxy.bans.database.BanDatabaseManager
import com.bovisgl.proxy.bans.model.Ban
import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.Player
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.*

class BanService(
    private val databaseManager: BanDatabaseManager,
    private val configManager: BanConfigManager,
    private val proxyServer: ProxyServer
) {
    private val logger: Logger = LoggerFactory.getLogger(BanService::class.java)
    
    fun banPlayer(
        playerUuid: UUID,
        playerName: String,
        bannedBy: String,
        reason: String,
        duration: LocalDateTime? = null
    ): Boolean {
        try {
            // Check if player is already banned
            if (databaseManager.isPlayerBanned(playerUuid)) {
                return false
            }
            
            // Ban the player
            val success = databaseManager.banPlayer(playerUuid, playerName, bannedBy, reason, duration)
            
            if (success) {
                // Add to history
                databaseManager.addBanHistory(playerUuid, playerName, "BAN", bannedBy, reason, null)
                
                // Kick player if online
                if (configManager.isKickOnBan()) {
                    kickBannedPlayer(playerUuid, reason, bannedBy, duration)
                }
                
                // Notify staff
                if (configManager.isNotifyStaffOnBan()) {
                    notifyStaff(playerName, bannedBy, reason, duration)
                }
                
                // Log to console
                if (configManager.isLogToConsole()) {
                    logger.info("Player $playerName was banned by $bannedBy for: $reason")
                }
            }
            
            return success
        } catch (e: Exception) {
            logger.error("Error banning player $playerName", e)
            return false
        }
    }
    
    fun unbanPlayer(playerUuid: UUID, playerName: String, unbannedBy: String): Boolean {
        try {
            // Check if player is banned
            if (!databaseManager.isPlayerBanned(playerUuid)) {
                return false
            }
            
            // Unban the player
            val success = databaseManager.unbanPlayer(playerUuid)
            
            if (success) {
                // Add to history
                databaseManager.addBanHistory(playerUuid, playerName, "UNBAN", unbannedBy, null, null)
                
                // Log to console
                if (configManager.isLogToConsole()) {
                    logger.info("Player $playerName was unbanned by $unbannedBy")
                }
            }
            
            return success
        } catch (e: Exception) {
            logger.error("Error unbanning player $playerName", e)
            return false
        }
    }
    
    fun getBan(playerUuid: UUID): Ban? {
        return databaseManager.getBan(playerUuid)
    }
    
    fun isPlayerBanned(playerUuid: UUID): Boolean {
        return databaseManager.isPlayerBanned(playerUuid)
    }
    
    fun getAllActiveBans(): List<Ban> {
        return databaseManager.getAllActiveBans()
    }
    
    fun getBanHistory(playerUuid: UUID) = databaseManager.getBanHistory(playerUuid)

    /** Update stored ban player name if changed */
    fun syncBanPlayerName(playerUuid: UUID, currentName: String) {
        try {
            val updated = databaseManager.updateBanPlayerName(playerUuid, currentName)
            if (updated && configManager.isLogToConsole()) {
                logger.info("Synchronized banned player name for $playerUuid to $currentName")
            }
        } catch (e: Exception) {
            logger.debug("Name sync failed for $playerUuid", e)
        }
    }
    
    private fun kickBannedPlayer(playerUuid: UUID, reason: String, bannedBy: String, expiresAt: LocalDateTime?) {
        proxyServer.getPlayer(playerUuid).ifPresent { player ->
            val message = if (expiresAt == null) {
                formatMessage(configManager.getMessage("kick.banned-permanent"), mapOf(
                    "reason" to reason,
                    "staff" to bannedBy
                ))
            } else {
                formatMessage(configManager.getMessage("kick.banned-temporary"), mapOf(
                    "reason" to reason,
                    "staff" to bannedBy,
                    "expires" to expiresAt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                ))
            }
            
            player.disconnect(Component.text(message))
        }
    }
    
    private fun notifyStaff(playerName: String, bannedBy: String, reason: String, expiresAt: LocalDateTime?) {
        val durationType = if (expiresAt == null) "permanently" else "temporarily"
        val message = Component.text("$playerName was banned $durationType by $bannedBy for: $reason", NamedTextColor.RED)
        
        proxyServer.allPlayers.forEach { player ->
            if (player.hasPermission("bovisgl.bans.notify")) {
                player.sendMessage(message)
            }
        }
    }
    
    private fun formatMessage(template: String, placeholders: Map<String, String>): String {
        var formatted = template
        placeholders.forEach { (key, value) ->
            formatted = formatted.replace("{$key}", value)
        }
        // Convert color codes
        return formatted.replace("&", "§")
    }
    
    fun checkBanOnLogin(playerUuid: UUID): Ban? {
        val ban = getBan(playerUuid)
        
        // Auto-remove expired bans
        if (ban != null && ban.isExpired()) {
            unbanPlayer(playerUuid, ban.playerName, "SYSTEM")
            return null
        }
        return ban
    }

    /** Variant used by listener supplying current username for sync */
    fun checkBanOnLogin(playerUuid: UUID, currentName: String): Ban? {
        val ban = checkBanOnLogin(playerUuid)
        if (ban != null && ban.playerName != currentName) {
            syncBanPlayerName(playerUuid, currentName)
        }
        
        return ban
    }
    
    fun cleanupExpiredBans(): Int {
        try {
            val activeBans = databaseManager.getAllActiveBans()
            var cleanedCount = 0
            
            activeBans.forEach { ban ->
                if (ban.isExpired()) {
                    if (databaseManager.unbanPlayer(ban.playerUuid)) {
                        databaseManager.addBanHistory(ban.playerUuid, ban.playerName, "UNBAN", "SYSTEM", "Ban expired", ban.id)
                        cleanedCount++
                        if (configManager.isLogToConsole()) {
                            logger.info("Auto-expired ban for ${ban.playerName}")
                        }
                    }
                }
            }
            
            return cleanedCount
        } catch (e: Exception) {
            logger.error("Error during ban cleanup", e)
            return 0
        }
    }
}
