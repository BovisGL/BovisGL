package com.bovisgl.hub.monitoring

import com.fasterxml.jackson.databind.ObjectMapper
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.bukkit.Bukkit
import org.bukkit.plugin.java.JavaPlugin
import org.bukkit.scheduler.BukkitRunnable
import java.util.concurrent.TimeUnit
import java.util.logging.Level

/**
 * Monitors hub server status and reports to the web dashboard
 */
class HubMonitoringService(private val plugin: JavaPlugin) {
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()
    
    private val objectMapper = ObjectMapper()
    
    private val API_BASE_URL = System.getenv("BOVISGL_COMMS") ?: "http://localhost:3456"
    private val SERVER_NAME = "hub"
    
    private var isRegistered = false
    private var heartbeatTask: BukkitRunnable? = null
    private var registrationTask: BukkitRunnable? = null
    private var startTime = System.currentTimeMillis()
    
    fun start() {
        plugin.logger.info("Starting hub monitoring service...")
        
        // Try to register immediately (async) and then retry every 30s until success
        registrationTask = object : BukkitRunnable() {
            override fun run() {
                if (!isRegistered) {
                    registerServer()
                } else {
                    this.cancel()
                }
            }
        }
        registrationTask?.runTaskTimerAsynchronously(plugin, 1L, 600L)
        
        // Start heartbeat every 30 seconds
        heartbeatTask = object : BukkitRunnable() {
            override fun run() {
                sendHeartbeat()
            }
        }
        heartbeatTask?.runTaskTimerAsynchronously(plugin, 600L, 600L) // 30 seconds = 600 ticks
        
        plugin.logger.info("Hub monitoring service started")
    }
    
    fun stop() {
        plugin.logger.info("Stopping hub monitoring service...")
        heartbeatTask?.cancel()
        unregisterServer()
        plugin.logger.info("Hub monitoring service stopped")
    }
    
    private fun registerServer() {
        val attemptTag = System.currentTimeMillis() // simple unique marker per attempt window
        try {
            plugin.logger.info("[registration] Hub attempt to connect to communications at $API_BASE_URL")
            val server = Bukkit.getServer()
            val registrationData = mapOf(
                "serverName" to SERVER_NAME,
                "serverType" to "hub",
                "port" to server.port,
                "version" to server.version,
                "startTime" to startTime
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
                    plugin.logger.info("[registration] Hub SUCCESS")
                } else {
                    plugin.logger.warning("[registration] Hub failure: ${response.code} - ${response.message}")
                }
            }
        } catch (e: Exception) {
            plugin.logger.log(Level.WARNING, "[registration] Hub exception: ${e.message}", e)
        }
    }
    
    private fun sendHeartbeat() {
    if (!isRegistered) return // registration retry task handles attempts
        
        try {
            val server = Bukkit.getServer()
            val currentTime = System.currentTimeMillis()
            val playerCount = server.onlinePlayers.size
            val maxPlayers = server.maxPlayers
            
            val heartbeatData = mapOf(
                "serverName" to SERVER_NAME,
                "status" to "online",
                "playerCount" to playerCount,
                "maxPlayers" to maxPlayers,
                "uptime" to (currentTime - startTime),
                "version" to server.version,
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
                    plugin.logger.fine("Hub heartbeat sent successfully - $playerCount/$maxPlayers players online")
                } else {
                    plugin.logger.warning("Failed to send hub heartbeat: ${response.code} - ${response.message}")
                    if (response.code == 404) {
                        isRegistered = false // Need to re-register
                    }
                }
            }
        } catch (e: Exception) {
            plugin.logger.log(Level.SEVERE, "Error sending hub heartbeat", e)
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
                    plugin.logger.info("Hub server unregistered successfully")
                } else {
                    plugin.logger.warning("Failed to unregister hub server: ${response.code} - ${response.message}")
                }
            }
        } catch (e: Exception) {
            plugin.logger.log(Level.SEVERE, "Error unregistering hub server", e)
        }
    }
}
