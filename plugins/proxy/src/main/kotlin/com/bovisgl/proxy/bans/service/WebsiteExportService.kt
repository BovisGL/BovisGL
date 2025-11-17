package com.bovisgl.proxy.bans.service

import com.bovisgl.proxy.bans.config.BanConfigManager
import com.bovisgl.proxy.bans.database.BanDatabaseManager
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.time.LocalDateTime
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class WebsiteExportService(
    private val configManager: BanConfigManager,
    private val databaseManager: BanDatabaseManager
) {
    private val logger: Logger = LoggerFactory.getLogger(WebsiteExportService::class.java)
    private val objectMapper = ObjectMapper()
    private val httpClient = OkHttpClient()
    
    fun startExportScheduler(executorService: ScheduledExecutorService) {
        // Export bans every 5 minutes
        executorService.scheduleAtFixedRate({
            try {
                exportBansToWebsite()
            } catch (e: Exception) {
                logger.error("Failed to export bans to website", e)
            }
        }, 1, 5, TimeUnit.MINUTES)
    }
    
    private fun exportBansToWebsite() {
        try {
            val activeBans = databaseManager.getAllActiveBans()
            
            val banData = activeBans.map { ban ->
                mapOf(
                    "id" to ban.id,
                    "playerUuid" to ban.playerUuid.toString(),
                    "playerName" to ban.playerName,
                    "bannedBy" to ban.bannedBy,
                    "reason" to ban.reason,
                    "bannedAt" to ban.bannedAt.toString(),
                    "expiresAt" to ban.expiresAt?.toString(),
                    "isPermanent" to ban.isPermanent(),
                    "isExpired" to ban.isExpired()
                )
            }
            
            val exportData = mapOf(
                "bans" to banData,
                "totalCount" to activeBans.size,
                "lastUpdated" to LocalDateTime.now().toString()
            )
            
            val json = objectMapper.writeValueAsString(exportData)
            
            // Send to website API (if configured)
            sendToWebsiteAPI(json)
            
            logger.debug("Exported ${activeBans.size} bans to website")
            
        } catch (e: Exception) {
            logger.error("Error exporting bans to website", e)
        }
    }
    
    fun exportBans() {
        exportBansToWebsite()
    }
    
    private fun sendToWebsiteAPI(jsonData: String) {
        // This would send the ban data to your website's API
        // Implementation depends on your website's API structure
        logger.debug("Ban data prepared for website export: ${jsonData.length} characters")
    }
    
    fun exportSingleBan(playerUuid: String) {
        try {
            val ban = databaseManager.getBan(java.util.UUID.fromString(playerUuid))
            if (ban != null) {
                val banData = mapOf(
                    "action" to "ban_added",
                    "ban" to mapOf(
                        "id" to ban.id,
                        "playerUuid" to ban.playerUuid.toString(),
                        "playerName" to ban.playerName,
                        "bannedBy" to ban.bannedBy,
                        "reason" to ban.reason,
                        "bannedAt" to ban.bannedAt.toString(),
                        "expiresAt" to ban.expiresAt?.toString(),
                        "isPermanent" to ban.isPermanent()
                    )
                )
                
                val json = objectMapper.writeValueAsString(banData)
                sendToWebsiteAPI(json)
            }
        } catch (e: Exception) {
            logger.error("Error exporting single ban for $playerUuid", e)
        }
    }
    
    fun exportBanRemoval(playerUuid: String) {
        try {
            val banData = mapOf(
                "action" to "ban_removed",
                "playerUuid" to playerUuid,
                "removedAt" to LocalDateTime.now().toString()
            )
            
            val json = objectMapper.writeValueAsString(banData)
            sendToWebsiteAPI(json)
        } catch (e: Exception) {
            logger.error("Error exporting ban removal for $playerUuid", e)
        }
    }
}
