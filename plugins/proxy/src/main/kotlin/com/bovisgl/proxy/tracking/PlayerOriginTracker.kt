package com.bovisgl.proxy.tracking

import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.player.ServerConnectedEvent
import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.Player
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Player Origin Tracker - Tracks which server players are coming from
 * Simple implementation that logs player movements for debugging
 */
class PlayerOriginTracker(private val proxyServer: ProxyServer) {
    
    private val playerOrigins = ConcurrentHashMap<UUID, String>()
    
    @Subscribe
    fun onServerConnected(event: ServerConnectedEvent) {
        val player = event.player
        val newServer = event.server.serverInfo.name
        
        // Get previous server from our tracking (safer approach)
        val previousServer = playerOrigins[player.uniqueId]
        
        // Log the connection for debugging
        if (previousServer != null && previousServer != newServer) {
            proxyServer.consoleCommandSource.sendMessage(
                net.kyori.adventure.text.Component.text(
                    "Player ${player.username} moved from $previousServer to $newServer"
                )
            )
            
            // Special handling for hub connections
            if (newServer.equals("hub", ignoreCase = true)) {
                proxyServer.consoleCommandSource.sendMessage(
                    net.kyori.adventure.text.Component.text(
                        "Player ${player.username} joined hub from $previousServer (origin tracked)"
                    )
                )
            }
        } else {
            // First time connecting or same server
            proxyServer.consoleCommandSource.sendMessage(
                net.kyori.adventure.text.Component.text(
                    "Player ${player.username} connected to $newServer"
                )
            )
        }
        
        // Update current server for next time
        playerOrigins[player.uniqueId] = newServer
    }
    
    /**
     * Get the last known server for a player
     */
    fun getPlayerOrigin(playerId: UUID): String? {
        return playerOrigins[playerId]
    }
    
    /**
     * Clear origin data for a player (e.g., when they disconnect)
     */
    fun clearPlayerOrigin(playerId: UUID) {
        playerOrigins.remove(playerId)
    }
    
    /**
     * Get all tracked origins (for debugging)
     */
    fun getAllOrigins(): Map<UUID, String> {
        return playerOrigins.toMap()
    }
}
