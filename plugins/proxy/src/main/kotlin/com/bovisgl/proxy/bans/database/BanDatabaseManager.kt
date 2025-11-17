package com.bovisgl.proxy.bans.database

import com.bovisgl.proxy.bans.model.Ban
import com.bovisgl.proxy.bans.model.BanHistory
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.SQLException
import java.time.LocalDateTime
import java.util.*
import java.io.File

enum class DatabaseType {
    SQLITE, POSTGRESQL
}

class BanDatabaseManager private constructor(
    private val databaseType: DatabaseType,
    private val connectionConfig: Map<String, Any>,
    private val poolConfig: Map<String, Any>
) {
    private val logger: Logger = LoggerFactory.getLogger(BanDatabaseManager::class.java)
    private lateinit var dataSource: HikariDataSource
    
    companion object {
        fun createSqliteManager(
            databaseFile: File,
            maxPoolSize: Int = 10,
            minIdle: Int = 2,
            connectionTimeout: Long = 30000,
            idleTimeout: Long = 600000,
            maxLifetime: Long = 1800000
        ): BanDatabaseManager {
            val connectionConfig = mapOf("file" to databaseFile.absolutePath)
            val poolConfig = mapOf(
                "maxPoolSize" to maxPoolSize,
                "minIdle" to minIdle,
                "connectionTimeout" to connectionTimeout,
                "idleTimeout" to idleTimeout,
                "maxLifetime" to maxLifetime
            )
            return BanDatabaseManager(DatabaseType.SQLITE, connectionConfig, poolConfig)
        }
        
        fun createPostgreSqlManager(
            host: String,
            port: Int,
            database: String,
            username: String,
            password: String,
            autoCreate: Boolean = true,
            maxPoolSize: Int = 10,
            minIdle: Int = 2,
            connectionTimeout: Long = 30000,
            idleTimeout: Long = 600000,
            maxLifetime: Long = 1800000
        ): BanDatabaseManager {
            val connectionConfig = mapOf(
                "host" to host,
                "port" to port,
                "database" to database,
                "username" to username,
                "password" to password,
                "autoCreate" to autoCreate
            )
            val poolConfig = mapOf(
                "maxPoolSize" to maxPoolSize,
                "minIdle" to minIdle,
                "connectionTimeout" to connectionTimeout,
                "idleTimeout" to idleTimeout,
                "maxLifetime" to maxLifetime
            )
            return BanDatabaseManager(DatabaseType.POSTGRESQL, connectionConfig, poolConfig)
        }
    }
    
    fun initialize() {
        try {
            setupDataSource()
            createTables()
            logger.info("Database initialized successfully")
        } catch (e: Exception) {
            logger.error("Failed to initialize database", e)
            throw e
        }
    }
    
    private fun setupDataSource() {
        val config = HikariConfig()
        
        when (databaseType) {
            DatabaseType.SQLITE -> {
                config.driverClassName = "org.sqlite.JDBC"
                config.jdbcUrl = "jdbc:sqlite:${connectionConfig["file"]}"
            }
            DatabaseType.POSTGRESQL -> {
                config.driverClassName = "org.postgresql.Driver"
                config.jdbcUrl = "jdbc:postgresql://${connectionConfig["host"]}:${connectionConfig["port"]}/${connectionConfig["database"]}"
                config.username = connectionConfig["username"] as String
                config.password = connectionConfig["password"] as String
            }
        }
        
        config.maximumPoolSize = poolConfig["maxPoolSize"] as Int
        config.minimumIdle = poolConfig["minIdle"] as Int
        config.connectionTimeout = poolConfig["connectionTimeout"] as Long
        config.idleTimeout = poolConfig["idleTimeout"] as Long
        config.maxLifetime = poolConfig["maxLifetime"] as Long
        
        dataSource = HikariDataSource(config)
    }
    
    private fun createTables() {
        connection.use { conn ->
            // Create bans table
            val createBansTable = when (databaseType) {
                DatabaseType.SQLITE -> """
                    CREATE TABLE IF NOT EXISTS bans (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        player_uuid TEXT NOT NULL UNIQUE,
                        player_name TEXT NOT NULL,
                        banned_by TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        banned_at DATETIME NOT NULL,
                        expires_at DATETIME,
                        is_active BOOLEAN NOT NULL DEFAULT 1
                    )
                """.trimIndent()
                DatabaseType.POSTGRESQL -> """
                    CREATE TABLE IF NOT EXISTS bans (
                        id SERIAL PRIMARY KEY,
                        player_uuid VARCHAR(36) NOT NULL UNIQUE,
                        player_name VARCHAR(255) NOT NULL,
                        banned_by VARCHAR(255) NOT NULL,
                        reason TEXT NOT NULL,
                        banned_at TIMESTAMP NOT NULL,
                        expires_at TIMESTAMP,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE
                    )
                """.trimIndent()
            }
            
            conn.prepareStatement(createBansTable).use { stmt ->
                stmt.executeUpdate()
            }
            
            // Create ban history table
            val createHistoryTable = when (databaseType) {
                DatabaseType.SQLITE -> """
                    CREATE TABLE IF NOT EXISTS ban_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        player_uuid TEXT NOT NULL,
                        player_name TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        performed_by TEXT NOT NULL,
                        reason TEXT,
                        performed_at DATETIME NOT NULL,
                        ban_id INTEGER,
                        FOREIGN KEY (ban_id) REFERENCES bans(id)
                    )
                """.trimIndent()
                DatabaseType.POSTGRESQL -> """
                    CREATE TABLE IF NOT EXISTS ban_history (
                        id SERIAL PRIMARY KEY,
                        player_uuid VARCHAR(36) NOT NULL,
                        player_name VARCHAR(255) NOT NULL,
                        action_type VARCHAR(50) NOT NULL,
                        performed_by VARCHAR(255) NOT NULL,
                        reason TEXT,
                        performed_at TIMESTAMP NOT NULL,
                        ban_id INTEGER,
                        FOREIGN KEY (ban_id) REFERENCES bans(id)
                    )
                """.trimIndent()
            }
            
            conn.prepareStatement(createHistoryTable).use { stmt ->
                stmt.executeUpdate()
            }
        }
    }
    
    val connection: Connection
        get() = dataSource.connection
    
    fun banPlayer(playerUuid: UUID, playerName: String, bannedBy: String, reason: String, expiresAt: LocalDateTime?): Boolean {
        return try {
            connection.use { conn ->
                val sql = "INSERT INTO bans (player_uuid, player_name, banned_by, reason, banned_at, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, playerUuid.toString())
                    stmt.setString(2, playerName)
                    stmt.setString(3, bannedBy)
                    stmt.setString(4, reason)
                    stmt.setObject(5, LocalDateTime.now())
                    stmt.setObject(6, expiresAt)
                    stmt.setBoolean(7, true)
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to ban player $playerName", e)
            false
        }
    }
    
    fun unbanPlayer(playerUuid: UUID): Boolean {
        return try {
            connection.use { conn ->
                val sql = "UPDATE bans SET is_active = ? WHERE player_uuid = ? AND is_active = ?"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setBoolean(1, false)
                    stmt.setString(2, playerUuid.toString())
                    stmt.setBoolean(3, true)
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to unban player $playerUuid", e)
            false
        }
    }
    
    fun getBan(playerUuid: UUID): Ban? {
        return try {
            connection.use { conn ->
                val sql = "SELECT * FROM bans WHERE player_uuid = ? AND is_active = ? ORDER BY banned_at DESC LIMIT 1"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, playerUuid.toString())
                    stmt.setBoolean(2, true)
                    stmt.executeQuery().use { rs ->
                        if (rs.next()) {
                            Ban(
                                id = rs.getInt("id"),
                                playerUuid = UUID.fromString(rs.getString("player_uuid")),
                                playerName = rs.getString("player_name"),
                                bannedBy = rs.getString("banned_by"),
                                reason = rs.getString("reason"),
                                bannedAt = rs.getObject("banned_at", LocalDateTime::class.java),
                                expiresAt = rs.getObject("expires_at", LocalDateTime::class.java),
                                isActive = rs.getBoolean("is_active")
                            )
                        } else null
                    }
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to get ban for player $playerUuid", e)
            null
        }
    }
    
    fun isPlayerBanned(playerUuid: UUID): Boolean {
        val ban = getBan(playerUuid) ?: return false
        
        // Check if ban has expired
        if (ban.expiresAt != null && ban.expiresAt.isBefore(LocalDateTime.now())) {
            // Auto-unban expired bans
            unbanPlayer(playerUuid)
            return false
        }
        
        return ban.isActive
    }
    
    fun getAllActiveBans(): List<Ban> {
        return try {
            connection.use { conn ->
                val sql = "SELECT * FROM bans WHERE is_active = ? ORDER BY banned_at DESC"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setBoolean(1, true)
                    stmt.executeQuery().use { rs ->
                        val bans = mutableListOf<Ban>()
                        while (rs.next()) {
                            bans.add(
                                Ban(
                                    id = rs.getInt("id"),
                                    playerUuid = UUID.fromString(rs.getString("player_uuid")),
                                    playerName = rs.getString("player_name"),
                                    bannedBy = rs.getString("banned_by"),
                                    reason = rs.getString("reason"),
                                    bannedAt = rs.getObject("banned_at", LocalDateTime::class.java),
                                    expiresAt = rs.getObject("expires_at", LocalDateTime::class.java),
                                    isActive = rs.getBoolean("is_active")
                                )
                            )
                        }
                        bans
                    }
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to get all active bans", e)
            emptyList()
        }
    }
    
    fun addBanHistory(playerUuid: UUID, playerName: String, actionType: String, performedBy: String, reason: String?, banId: Int?) {
        try {
            connection.use { conn ->
                val sql = "INSERT INTO ban_history (player_uuid, player_name, action_type, performed_by, reason, performed_at, ban_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, playerUuid.toString())
                    stmt.setString(2, playerName)
                    stmt.setString(3, actionType)
                    stmt.setString(4, performedBy)
                    stmt.setString(5, reason)
                    stmt.setObject(6, LocalDateTime.now())
                    if (banId != null) {
                        stmt.setInt(7, banId)
                    } else {
                        stmt.setNull(7, java.sql.Types.INTEGER)
                    }
                    stmt.executeUpdate()
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to add ban history", e)
        }
    }
    
    fun getBanHistory(playerUuid: UUID): List<BanHistory> {
        return try {
            connection.use { conn ->
                val sql = "SELECT * FROM ban_history WHERE player_uuid = ? ORDER BY performed_at DESC"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, playerUuid.toString())
                    stmt.executeQuery().use { rs ->
                        val history = mutableListOf<BanHistory>()
                        while (rs.next()) {
                            history.add(
                                BanHistory(
                                    id = rs.getInt("id"),
                                    playerUuid = UUID.fromString(rs.getString("player_uuid")),
                                    playerName = rs.getString("player_name"),
                                    actionType = rs.getString("action_type"),
                                    performedBy = rs.getString("performed_by"),
                                    reason = rs.getString("reason"),
                                    performedAt = rs.getObject("performed_at", LocalDateTime::class.java),
                                    banId = rs.getObject("ban_id") as? Int
                                )
                            )
                        }
                        history
                    }
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to get ban history for player $playerUuid", e)
            emptyList()
        }
    }

    /**
     * Update the stored player_name for an active ban if the player has changed their username.
     * Returns true if an active ban row was updated, false otherwise.
     */
    fun updateBanPlayerName(playerUuid: UUID, newName: String): Boolean {
        return try {
            connection.use { conn ->
                val sql = "UPDATE bans SET player_name = ? WHERE player_uuid = ? AND is_active = ? AND player_name <> ?"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, newName)
                    stmt.setString(2, playerUuid.toString())
                    stmt.setBoolean(3, true)
                    stmt.setString(4, newName)
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.warn("Failed to update ban player name for $playerUuid", e)
            false
        }
    }
    
    fun close() {
        try {
            if (::dataSource.isInitialized) {
                dataSource.close()
            }
        } catch (e: Exception) {
            logger.error("Error closing database", e)
        }
    }
}
