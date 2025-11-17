package com.bovisgl.proxy.tracking.database

import com.bovisgl.proxy.tracking.model.PlayerData
import com.bovisgl.proxy.tracking.model.ServerStats
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.sql.Connection
import java.sql.SQLException
import java.time.LocalDateTime
import java.util.*
import java.io.File

enum class DatabaseType {
    SQLITE, POSTGRESQL
}

class TrackingDatabaseManager private constructor(
    private val databaseType: DatabaseType,
    private val connectionConfig: Map<String, Any>,
    private val poolConfig: Map<String, Any>
) {
    private val logger: Logger = LoggerFactory.getLogger(TrackingDatabaseManager::class.java)
    private lateinit var dataSource: HikariDataSource
    
    companion object {
        fun createSqliteManager(
            databaseFile: File,
            maxPoolSize: Int = 10,
            minIdle: Int = 2,
            connectionTimeout: Long = 30000,
            idleTimeout: Long = 600000,
            maxLifetime: Long = 1800000
        ): TrackingDatabaseManager {
            val connectionConfig = mapOf("file" to databaseFile.absolutePath)
            val poolConfig = mapOf(
                "maxPoolSize" to maxPoolSize,
                "minIdle" to minIdle,
                "connectionTimeout" to connectionTimeout,
                "idleTimeout" to idleTimeout,
                "maxLifetime" to maxLifetime
            )
            return TrackingDatabaseManager(DatabaseType.SQLITE, connectionConfig, poolConfig)
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
        ): TrackingDatabaseManager {
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
            return TrackingDatabaseManager(DatabaseType.POSTGRESQL, connectionConfig, poolConfig)
        }
    }
    
    fun initialize() {
        try {
            setupDataSource()
            createTables()
            logger.info("Tracking database initialized successfully")
        } catch (e: Exception) {
            logger.error("Failed to initialize tracking database", e)
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
            // Create player_data table
            val createPlayerDataTable = when (databaseType) {
                DatabaseType.SQLITE -> """
                    CREATE TABLE IF NOT EXISTS player_data (
                        uuid TEXT PRIMARY KEY,
                        username TEXT NOT NULL,
                        first_join DATETIME NOT NULL,
                        last_seen DATETIME NOT NULL,
                        total_playtime INTEGER NOT NULL DEFAULT 0,
                        current_server TEXT,
                        last_server TEXT,
                        join_count INTEGER NOT NULL DEFAULT 1
                    )
                """.trimIndent()
                DatabaseType.POSTGRESQL -> """
                    CREATE TABLE IF NOT EXISTS player_data (
                        uuid VARCHAR(36) PRIMARY KEY,
                        username VARCHAR(255) NOT NULL,
                        first_join TIMESTAMP NOT NULL,
                        last_seen TIMESTAMP NOT NULL,
                        total_playtime BIGINT NOT NULL DEFAULT 0,
                        current_server VARCHAR(255),
                        last_server VARCHAR(255),
                        join_count INTEGER NOT NULL DEFAULT 1
                    )
                """.trimIndent()
            }
            
            conn.prepareStatement(createPlayerDataTable).use { stmt ->
                stmt.executeUpdate()
            }
            
            // Create per-server playtime table
            val createPlaytimeTable = when (databaseType) {
                DatabaseType.SQLITE -> """
                    CREATE TABLE IF NOT EXISTS playtime_stats (
                        uuid TEXT NOT NULL,
                        server_name TEXT NOT NULL,
                        total_minutes INTEGER NOT NULL DEFAULT 0,
                        PRIMARY KEY (uuid, server_name)
                    )
                """.trimIndent()
                DatabaseType.POSTGRESQL -> """
                    CREATE TABLE IF NOT EXISTS playtime_stats (
                        uuid VARCHAR(36) NOT NULL,
                        server_name VARCHAR(255) NOT NULL,
                        total_minutes BIGINT NOT NULL DEFAULT 0,
                        PRIMARY KEY (uuid, server_name)
                    )
                """.trimIndent()
            }
            conn.prepareStatement(createPlaytimeTable).use { stmt ->
                stmt.executeUpdate()
            }

            // Create server_stats table
            val createServerStatsTable = when (databaseType) {
                DatabaseType.SQLITE -> """
                    CREATE TABLE IF NOT EXISTS server_stats (
                        server_name TEXT PRIMARY KEY,
                        online_players INTEGER NOT NULL DEFAULT 0,
                        max_players INTEGER NOT NULL DEFAULT 0,
                        last_updated DATETIME NOT NULL
                    )
                """.trimIndent()
                DatabaseType.POSTGRESQL -> """
                    CREATE TABLE IF NOT EXISTS server_stats (
                        server_name VARCHAR(255) PRIMARY KEY,
                        online_players INTEGER NOT NULL DEFAULT 0,
                        max_players INTEGER NOT NULL DEFAULT 0,
                        last_updated TIMESTAMP NOT NULL
                    )
                """.trimIndent()
            }
            
            conn.prepareStatement(createServerStatsTable).use { stmt ->
                stmt.executeUpdate()
            }
        }
    }
    
    val connection: Connection
        get() = dataSource.connection
    
    fun getPlayerData(uuid: UUID): PlayerData? {
        return try {
            connection.use { conn ->
                val sql = "SELECT * FROM player_data WHERE uuid = ?"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, uuid.toString())
                    stmt.executeQuery().use { rs ->
                        if (rs.next()) {
                            PlayerData(
                                uuid = UUID.fromString(rs.getString("uuid")),
                                username = rs.getString("username"),
                                firstJoin = rs.getObject("first_join", LocalDateTime::class.java),
                                lastSeen = rs.getObject("last_seen", LocalDateTime::class.java),
                                totalPlaytime = rs.getLong("total_playtime"),
                                currentServer = rs.getString("current_server"),
                                lastServer = rs.getString("last_server"),
                                joinCount = rs.getInt("join_count")
                            )
                        } else null
                    }
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to get player data for $uuid", e)
            null
        }
    }
    
    fun createPlayerData(uuid: UUID, username: String, serverName: String): Boolean {
        return try {
            connection.use { conn ->
                val sql = """
                    INSERT INTO player_data (uuid, username, first_join, last_seen, current_server, last_server)
                    VALUES (?, ?, ?, ?, ?, ?)
                """.trimIndent()
                conn.prepareStatement(sql).use { stmt ->
                    val now = LocalDateTime.now()
                    stmt.setString(1, uuid.toString())
                    stmt.setString(2, username)
                    stmt.setObject(3, now)
                    stmt.setObject(4, now)
                    stmt.setString(5, serverName)
                    stmt.setString(6, serverName)
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to create player data for $uuid", e)
            false
        }
    }
    
    fun updatePlayerLogin(uuid: UUID, username: String, serverName: String): Boolean {
        return try {
            connection.use { conn ->
                val sql = """
                    UPDATE player_data 
                    SET username = ?, last_seen = ?, current_server = ?, join_count = join_count + 1
                    WHERE uuid = ?
                """.trimIndent()
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, username)
                    stmt.setObject(2, LocalDateTime.now())
                    stmt.setString(3, serverName)
                    stmt.setString(4, uuid.toString())
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to update player login for $uuid", e)
            false
        }
    }
    
    fun updatePlayerLogout(uuid: UUID, playtimeSessionMinutes: Long): Boolean {
        return try {
            connection.use { conn ->
                val sql = """
                    UPDATE player_data 
                    SET last_seen = ?, current_server = NULL, last_server = current_server, total_playtime = total_playtime + ?
                    WHERE uuid = ?
                """.trimIndent()
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setObject(1, LocalDateTime.now())
                    stmt.setLong(2, playtimeSessionMinutes)
                    stmt.setString(3, uuid.toString())
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to update player logout for $uuid", e)
            false
        }
    }

    /**
     * Add playtime minutes for a specific server for the player.
     */
    fun addPlaytimeForServer(uuid: UUID, serverName: String, minutes: Long): Boolean {
        if (minutes <= 0) return true
        return try {
            connection.use { conn ->
                val upsert = when (databaseType) {
                    DatabaseType.SQLITE -> """
                        INSERT INTO playtime_stats (uuid, server_name, total_minutes)
                        VALUES (?, ?, ?)
                        ON CONFLICT(uuid, server_name) DO UPDATE SET total_minutes = total_minutes + excluded.total_minutes
                    """.trimIndent()
                    DatabaseType.POSTGRESQL -> """
                        INSERT INTO playtime_stats (uuid, server_name, total_minutes)
                        VALUES (?, ?, ?)
                        ON CONFLICT (uuid, server_name) DO UPDATE SET total_minutes = playtime_stats.total_minutes + EXCLUDED.total_minutes
                    """.trimIndent()
                }
                conn.prepareStatement(upsert).use { stmt ->
                    stmt.setString(1, uuid.toString())
                    stmt.setString(2, serverName)
                    stmt.setLong(3, minutes)
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to add playtime for $uuid on $serverName", e)
            false
        }
    }
    
    fun updatePlayerServerSwitch(uuid: UUID, newServerName: String): Boolean {
        return try {
            connection.use { conn ->
                val sql = """
                    UPDATE player_data 
                    SET last_server = current_server, current_server = ?, last_seen = ?
                    WHERE uuid = ?
                """.trimIndent()
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, newServerName)
                    stmt.setObject(2, LocalDateTime.now())
                    stmt.setString(3, uuid.toString())
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to update player server switch for $uuid", e)
            false
        }
    }

    /**
     * Increment total playtime for a player without ending their session.
     */
    fun incrementTotalPlaytime(uuid: UUID, minutes: Long): Boolean {
        if (minutes <= 0) return true
        return try {
            connection.use { conn ->
                val sql = """
                    UPDATE player_data
                    SET last_seen = ?, total_playtime = total_playtime + ?
                    WHERE uuid = ?
                """.trimIndent()
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setObject(1, LocalDateTime.now())
                    stmt.setLong(2, minutes)
                    stmt.setString(3, uuid.toString())
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to increment total playtime for $uuid", e)
            false
        }
    }
    
    fun updateServerStats(serverName: String, onlinePlayers: Int, maxPlayers: Int): Boolean {
        return try {
            connection.use { conn ->
                val sql = """
                    INSERT OR REPLACE INTO server_stats (server_name, online_players, max_players, last_updated)
                    VALUES (?, ?, ?, ?)
                """.trimIndent()
                conn.prepareStatement(sql).use { stmt ->
                    stmt.setString(1, serverName)
                    stmt.setInt(2, onlinePlayers)
                    stmt.setInt(3, maxPlayers)
                    stmt.setObject(4, LocalDateTime.now())
                    stmt.executeUpdate() > 0
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to update server stats for $serverName", e)
            false
        }
    }
    
    fun getAllServerStats(): List<ServerStats> {
        return try {
            connection.use { conn ->
                val sql = "SELECT * FROM server_stats ORDER BY server_name"
                conn.prepareStatement(sql).use { stmt ->
                    stmt.executeQuery().use { rs ->
                        val stats = mutableListOf<ServerStats>()
                        while (rs.next()) {
                            stats.add(
                                ServerStats(
                                    serverName = rs.getString("server_name"),
                                    onlinePlayers = rs.getInt("online_players"),
                                    maxPlayers = rs.getInt("max_players"),
                                    lastUpdated = rs.getObject("last_updated", LocalDateTime::class.java)
                                )
                            )
                        }
                        stats
                    }
                }
            }
        } catch (e: SQLException) {
            logger.error("Failed to get all server stats", e)
            emptyList()
        }
    }
    
    fun close() {
        try {
            if (::dataSource.isInitialized) {
                dataSource.close()
            }
        } catch (e: Exception) {
            logger.error("Error closing tracking database", e)
        }
    }
}
