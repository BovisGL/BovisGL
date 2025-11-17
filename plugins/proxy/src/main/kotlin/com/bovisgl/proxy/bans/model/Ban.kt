package com.bovisgl.proxy.bans.model

import java.time.LocalDateTime
import java.util.*

data class Ban(
    val id: Int,
    val playerUuid: UUID,
    val playerName: String,
    val bannedBy: String,
    val reason: String,
    val bannedAt: LocalDateTime,
    val expiresAt: LocalDateTime?,
    val isActive: Boolean = true
) {
    fun isExpired(): Boolean {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt)
    }
    
    fun isPermanent(): Boolean {
        return expiresAt == null
    }
    
    fun getRemainingDuration(): Long? {
        if (isPermanent()) return null
        if (isExpired()) return 0
        return expiresAt?.let { 
            java.time.Duration.between(LocalDateTime.now(), it).toMinutes() 
        }
    }
    
    fun getFormattedExpiry(): String {
        return if (isPermanent()) {
            "Never"
        } else {
            expiresAt?.toString() ?: "Never"
        }
    }
}

data class BanHistory(
    val id: Int,
    val playerUuid: UUID,
    val playerName: String,
    val actionType: String, // BAN, UNBAN, TEMP_BAN
    val performedBy: String,
    val reason: String?,
    val performedAt: LocalDateTime,
    val banId: Int?
)
