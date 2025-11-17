package com.bovisgl.proxy.api

import com.sun.net.httpserver.HttpServer
import com.sun.net.httpserver.HttpExchange
import com.velocitypowered.api.proxy.ProxyServer
import com.google.gson.Gson
import net.kyori.adventure.text.Component
import org.slf4j.Logger
import java.net.InetSocketAddress
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Simple HTTP API endpoint for proxy administrative actions like kicking players.
 * Runs on port 25578 by default (configurable via bovisgl.proxy.api.port system property).
 */
class KickPlayerEndpoint(
    private val server: ProxyServer,
    private val logger: Logger
) {
    private var httpServer: HttpServer? = null
    private val port = System.getProperty("bovisgl.proxy.api.port", "25578").toIntOrNull() ?: 25578
    private val gson = Gson()
    
    fun start() {
        try {
            httpServer = HttpServer.create(InetSocketAddress("127.0.0.1", port), 0)
            httpServer!!.executor = Executors.newFixedThreadPool(2)
            
            // POST /api/kick-player - kick a player by UUID with optional message
            httpServer!!.createContext("/api/kick-player") { exchange ->
                handleKickPlayer(exchange)
            }
            
            // Health check endpoint
            httpServer!!.createContext("/health") { exchange ->
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = "{\"status\":\"ok\",\"service\":\"proxy-api\"}"
                exchange.sendResponseHeaders(200, response.length.toLong())
                exchange.responseBody.use { it.write(response.toByteArray()) }
            }
            
            httpServer!!.start()
            logger.info("🌐 Proxy API endpoint started on port $port")
        } catch (e: Exception) {
            logger.error("❌ Failed to start proxy API endpoint: ${e.message}", e)
        }
    }
    
    fun stop() {
        httpServer?.stop(0)
        logger.info("🌐 Proxy API endpoint stopped")
    }
    
    private fun handleKickPlayer(exchange: HttpExchange) {
        try {
            if (exchange.requestMethod != "POST") {
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = "{\"error\":\"Method not allowed\"}"
                exchange.sendResponseHeaders(405, response.length.toLong())
                exchange.responseBody.use { it.write(response.toByteArray()) }
                return
            }
            
            // Parse JSON body
            val body = exchange.requestBody.bufferedReader().use { it.readText() }
            val json = gson.fromJson(body, Map::class.java) as Map<String, Any>
            
            val uuidStr = json["uuid"] as? String
            val reason = json["reason"] as? String ?: "You have been kicked from the server"
            
            if (uuidStr == null) {
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = "{\"error\":\"uuid required\"}"
                exchange.sendResponseHeaders(400, response.length.toLong())
                exchange.responseBody.use { it.write(response.toByteArray()) }
                return
            }
            
            // Find and kick the player
            val uuid = try {
                UUID.fromString(uuidStr)
            } catch (e: IllegalArgumentException) {
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = "{\"error\":\"invalid uuid format\"}"
                exchange.sendResponseHeaders(400, response.length.toLong())
                exchange.responseBody.use { it.write(response.toByteArray()) }
                return
            }
            
            val player = server.getPlayer(uuid).orElse(null)
            if (player != null) {
                logger.warn("⚠️ [API] Kicking player ${player.username} ($uuid) - Reason: $reason")
                player.disconnect(Component.text(reason as String))
                
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = "{\"status\":\"kicked\",\"uuid\":\"$uuidStr\",\"username\":\"${player.username}\"}"
                exchange.sendResponseHeaders(200, response.length.toLong())
                exchange.responseBody.use { it.write(response.toByteArray()) }
            } else {
                logger.debug("ℹ️ [API] Player $uuidStr not connected to proxy")
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = "{\"status\":\"not_connected\",\"uuid\":\"$uuidStr\"}"
                exchange.sendResponseHeaders(200, response.length.toLong())
                exchange.responseBody.use { it.write(response.toByteArray()) }
            }
        } catch (e: Exception) {
            logger.error("❌ [API] Error handling kick request: ${e.message}", e)
            exchange.responseHeaders.set("Content-Type", "application/json")
            val response = "{\"error\":\"${e.message}\"}"
            exchange.sendResponseHeaders(500, response.length.toLong())
            exchange.responseBody.use { it.write(response.toByteArray()) }
        }
    }
}
