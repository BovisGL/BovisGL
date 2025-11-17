package com.bovisgl.proxy.monitoring

import com.fasterxml.jackson.databind.ObjectMapper
import com.velocitypowered.api.proxy.ProxyServer
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.slf4j.Logger
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Monitors proxy server status and reports to the web dashboard
 */
class ProxyMonitoringService(
    private val server: ProxyServer,
    private val logger: Logger,
    private val executorService: ScheduledExecutorService
) {
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()
    
    private val objectMapper = ObjectMapper()
    
    private val API_BASE_URL = System.getenv("BOVISGL_COMMS") ?: "http://localhost:3456"
    private val SERVER_NAME = "proxy"
    
    private var isRegistered = false
    private var lastHeartbeat = 0L
    private var registrationTask: java.util.concurrent.ScheduledFuture<*>? = null
    
    fun start() {
        logger.info("Starting proxy monitoring service...")
        
        // Try to register immediately and then retry every 30s until success
        registrationTask = executorService.scheduleAtFixedRate({
            try {
                if (!isRegistered) {
                    registerServer()
                } else {
                    registrationTask?.cancel(false)
                }
            } catch (_: Throwable) { /* ignore */ }
        }, 0, 30, TimeUnit.SECONDS)
        
        // Start heartbeat every 30 seconds
        executorService.scheduleAtFixedRate({
            sendHeartbeat()
        }, 30, 30, TimeUnit.SECONDS)
        
        logger.info("Proxy monitoring service started")
    }
    
    fun stop() {
        logger.info("Stopping proxy monitoring service...")
        unregisterServer()
        logger.info("Proxy monitoring service stopped")
    }
    
    private fun registerServer() {
        try {
            logger.info("[registration] Proxy attempt to connect to communications at $API_BASE_URL")
            val registrationData = mapOf(
                "serverName" to SERVER_NAME,
                "serverType" to "proxy",
                "port" to server.boundAddress.port,
                "version" to "1.0.0",
                "startTime" to System.currentTimeMillis()
            )
            val json = objectMapper.writeValueAsString(registrationData)
            val requestBody = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$API_BASE_URL/api/servers/register")
                .post(requestBody)
                .build()
            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    isRegistered = true
                    logger.info("[registration] Proxy SUCCESS")
                } else {
                    logger.warn("[registration] Proxy failure: ${response.code} - ${response.message}")
                }
            }
        } catch (e: Exception) {
            logger.error("[registration] Proxy exception: ${e.message}")
        }
    }
    
    private fun sendHeartbeat() {
    if (!isRegistered) return // registration retry task handles attempts
        
        try {
            val currentTime = System.currentTimeMillis()
            val playerCount = server.allPlayers.size
            val maxPlayers = 100 // Proxy doesn't have max players, use reasonable default
            
            val heartbeatData = mapOf(
                "serverName" to SERVER_NAME,
                "status" to "online",
                "playerCount" to playerCount,
                "maxPlayers" to 100, // Proxy doesn't have max players, use reasonable default
                "uptime" to (currentTime - lastHeartbeat),
                "version" to "1.0.0",
                "lastSeen" to currentTime
            )
            
            val json = objectMapper.writeValueAsString(heartbeatData)
            val requestBody = json.toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url("$API_BASE_URL/api/servers/heartbeat")
                .post(requestBody)
                .build()
            
            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    lastHeartbeat = currentTime
                    logger.debug("Proxy heartbeat sent successfully - $playerCount players online")
                } else {
                    logger.warn("Failed to send proxy heartbeat: ${response.code} - ${response.message}")
                    if (response.code == 404) {
                        isRegistered = false // Need to re-register
                    }
                }
            }
        } catch (e: Exception) {
            logger.error("Error sending proxy heartbeat", e)
        }
    }
    
    private fun unregisterServer() {
        if (!isRegistered) return
        
        try {
            val unregisterData = mapOf(
                "serverName" to SERVER_NAME
            )
            
            val json = objectMapper.writeValueAsString(unregisterData)
            val requestBody = json.toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url("$API_BASE_URL/api/servers/unregister")
                .post(requestBody)
                .build()
            
            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    logger.info("Proxy server unregistered successfully")
                } else {
                    logger.warn("Failed to unregister proxy server: ${response.code} - ${response.message}")
                }
            }
        } catch (e: Exception) {
            logger.error("Error unregistering proxy server", e)
        }
    }
}
