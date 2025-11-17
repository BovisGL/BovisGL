package com.bovisgl.proxy.tracking.model

import java.time.LocalDateTime
import java.util.*

data class PlayerData(
    val uuid: UUID,
    val username: String,
    val firstJoin: LocalDateTime,
    val lastSeen: LocalDateTime,
    val totalPlaytime: Long, // in minutes
    val currentServer: String?,
    val lastServer: String?,
    val joinCount: Int
) {
    fun getFormattedPlaytime(): String {
        val hours = totalPlaytime / 60
        val minutes = totalPlaytime % 60
        
        return when {
            hours == 0L -> "${minutes}m"
            minutes == 0L -> "${hours}h"
            else -> "${hours}h ${minutes}m"
        }
    }
    
    fun isOnline(): Boolean = currentServer != null
    
    fun isFirstTime(): Boolean = joinCount == 1
}

data class ServerStats(
    val serverName: String,
    val onlinePlayers: Int,
    val maxPlayers: Int,
    val lastUpdated: LocalDateTime
)
