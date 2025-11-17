package com.bovisgl.proxy

import com.bovisgl.proxy.client.ClientDetectListener
import com.google.gson.Gson
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.connection.PostLoginEvent
import com.velocitypowered.api.event.ResultedEvent
import com.velocitypowered.api.event.connection.LoginEvent
import net.kyori.adventure.text.Component
import org.slf4j.Logger
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * ProxyBanListener - checks ban status via communications service during login.
 * Detects account type (java/bedrock) and sends it with player data.
 */
class ProxyBanListener(private val logger: Logger, private val clientDetectListener: ClientDetectListener) {
    private val gson = Gson()
    private val communicationsBase = System.getProperty("bovisgl.communications.base", "http://127.0.0.1:3456")

    data class BanCheckResponse(val banned: Boolean = false, val ban: Map<String, Any>? = null)

    @Subscribe
    fun onLogin(event: LoginEvent) {
        val player = event.player
        val username = player.username
        logger.info("📝 [LOGIN PIPELINE] Player login initiated: $username")
    }

    @Subscribe
    fun onPostLogin(event: PostLoginEvent) {
        val player = event.player
        val uuid = player.uniqueId
        val uuidStr = uuid.toString()
        val username = player.username
        
        logger.info("✅ [LOGIN PIPELINE] Player authenticated: $username ($uuidStr)")
        
        try {
            logger.info("🔍 [LOGIN PIPELINE] Checking ban status in database...")
            
            // Detect client type from client info (what client is connecting NOW)
            val clientToken = clientDetectListener.currentClientToken(uuid)
            val isBedrockClient = clientToken?.startsWith("bedrock") == true
            val clientType = when {
                isBedrockClient -> "bedrock"
                clientToken?.startsWith("java") == true -> "java"
                else -> "unknown"
            }
            
            // Detect account type ONLY from UUID pattern (not from client)
            // Bedrock UUIDs have a specific pattern: 00000000-0000-0000-XXXX-XXXXXXXXXXXX
            val isBedrockAccount = uuidStr.startsWith("00000000-0000-0000-")
            val accountType = if (isBedrockAccount) "bedrock" else "java"
            
            logger.info("👤 [LOGIN PIPELINE] Client Type: $clientType (from connection)")
            logger.info("👤 [LOGIN PIPELINE] Account Type: $accountType (from UUID pattern)")
            
            // Check ban status via communications service using UUID
            val url = URL("$communicationsBase/api/players/$uuidStr/ban")
            val http = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 2500
                readTimeout = 2500
                setRequestProperty("Accept", "application/json")
            }
            
            try {
                val responseText = http.inputStream.bufferedReader().use { it.readText() }
                val resp = gson.fromJson(responseText, BanCheckResponse::class.java)
                
                if (resp.banned) {
                    val reason = (resp.ban?.get("reason") as? String) ?: "No reason provided"
                    val bannedBy = (resp.ban?.get("banned_by") as? String) ?: "System"
                    val bannedAt = (resp.ban?.get("banned_at") as? Number)?.toLong() ?: 0L
                    
                    logger.warn("🚫 [LOGIN PIPELINE] BANNED PLAYER: $username ($uuidStr)")
                    logger.warn("    Client Type: $clientType")
                    logger.warn("    Account Type: $accountType")
                    logger.warn("    Reason: $reason")
                    logger.warn("    Banned By: $bannedBy")
                    
                    // Build simple kick message that works for both Java and Bedrock
                    // Avoid complex formatting that might break Bedrock connections
                    val kickMessage = "You are banned\nReason: $reason\nBanned by: $bannedBy"
                    
                    logger.info("🔴 [LOGIN PIPELINE] [$clientType/$accountType] Kicking banned player with message:\n$kickMessage")
                    player.disconnect(Component.text(kickMessage))
                    logger.info("✓ [LOGIN PIPELINE] [$clientType/$accountType] Disconnect called for $username")
                    return
                }
                logger.info("✨ [LOGIN PIPELINE] Ban check completed - player $username allowed to join")
            } catch (e: java.io.IOException) {
                logger.error("❌ [LOGIN PIPELINE] Communications service connection error: ${e.message}")
                player.disconnect(Component.text("Cannot verify your account.\nThe authentication service is unavailable.\nPlease try again later."))
                return
            }
        } catch (e: java.net.SocketTimeoutException) {
            logger.error("⏱️ [LOGIN PIPELINE] Ban check timeout: ${e.message}")
            player.disconnect(Component.text("§cAuthentication service timeout.\n§7Please try again later."))
        } catch (e: Exception) {
            logger.error("❌ [LOGIN PIPELINE] Unexpected error during ban check: ${e.message}", e)
            player.disconnect(Component.text("§cLogin verification failed.\n§7Please try again later."))
        }
    }
}
