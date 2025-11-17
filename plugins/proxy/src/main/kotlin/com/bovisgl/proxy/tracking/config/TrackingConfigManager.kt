package com.bovisgl.proxy.tracking.config

import org.yaml.snakeyaml.Yaml
import java.io.File
import java.io.FileReader
import java.io.FileWriter
import java.nio.file.Path

class TrackingConfigManager(private val dataDirectory: Path) {
    
    private val yaml = Yaml()
    private var config: Map<String, Any> = emptyMap()
    private var messages: Map<String, Any> = emptyMap()
    
    fun loadConfig() {
        try {
            val configFile = dataDirectory.resolve("tracking-config.yml").toFile()
            if (!configFile.exists()) {
                copyDefaultConfig(configFile)
            }
            
            FileReader(configFile).use { reader ->
                config = yaml.load(reader) ?: emptyMap()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to load tracking-config.yml", e)
        }
    }
    
    fun loadMessages() {
        try {
            val messagesFile = dataDirectory.resolve("tracking-messages.yml").toFile()
            if (!messagesFile.exists()) {
                copyDefaultMessages(messagesFile)
            }
            
            FileReader(messagesFile).use { reader ->
                messages = yaml.load(reader) ?: emptyMap()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to load tracking-messages.yml", e)
        }
    }
    
    fun reload() {
        loadConfig()
        loadMessages()
    }
    
    // Database configuration
    fun getDatabaseType(): String = config["database.type"] as? String ?: "sqlite"
    fun getDatabaseHost(): String = config["database.host"] as? String ?: "localhost"
    fun getDatabasePort(): Int = config["database.port"] as? Int ?: 5432
    fun getDatabaseName(): String = config["database.name"] as? String ?: "bovisgl_tracking"
    fun getDatabaseUsername(): String = config["database.username"] as? String ?: "root"
    fun getDatabasePassword(): String = config["database.password"] as? String ?: ""
    fun getDatabaseAutoCreate(): Boolean = config["database.auto-create"] as? Boolean ?: true
    fun getSqliteFile(): File = dataDirectory.resolve(config["database.sqlite-file"] as? String ?: "tracking.db").toFile()
    
    // Connection pool settings
    fun getMaxPoolSize(): Int = config["database.connection-pool.max-pool-size"] as? Int ?: 10
    fun getMinIdle(): Int = config["database.connection-pool.min-idle"] as? Int ?: 2
    fun getConnectionTimeout(): Long = config["database.connection-pool.connection-timeout"] as? Long ?: 30000L
    fun getIdleTimeout(): Long = config["database.connection-pool.idle-timeout"] as? Long ?: 600000L
    fun getMaxLifetime(): Long = config["database.connection-pool.max-lifetime"] as? Long ?: 1800000L
    
    // Feature configuration
    fun isTrackingEnabled(): Boolean = config["features.tracking-enabled"] as? Boolean ?: true
    fun isWelcomeMessagesEnabled(): Boolean = config["features.welcome-messages"] as? Boolean ?: true
    fun isCrossPlatformEnabled(): Boolean = config["features.cross-platform"] as? Boolean ?: true
    fun isServerStatusEnabled(): Boolean = config["features.server-status"] as? Boolean ?: true
    
    // Server configuration
    @Suppress("UNCHECKED_CAST")
    fun getServers(): Map<String, Map<String, Any>> {
        return config["servers"] as? Map<String, Map<String, Any>> ?: emptyMap()
    }
    
    // Message configuration
    fun getMessage(key: String): String {
        return messages[key] as? String ?: "&cMessage not found: $key"
    }
    
    private fun copyDefaultConfig(configFile: File) {
        configFile.parentFile.mkdirs()
        FileWriter(configFile).use { writer ->
            writer.write(getDefaultConfig())
        }
    }
    
    private fun copyDefaultMessages(messagesFile: File) {
        messagesFile.parentFile.mkdirs()
        FileWriter(messagesFile).use { writer ->
            writer.write(getDefaultMessages())
        }
    }
    
    private fun getDefaultConfig(): String = """
# BovisGL Player Tracking Configuration
database:
  type: "sqlite"  # sqlite or postgresql
  host: "localhost"
  port: 5432
  name: "bovisgl_tracking"
  username: "root"
  password: ""
  auto-create: true
  sqlite-file: "tracking.db"
  
  connection-pool:
    max-pool-size: 10
    min-idle: 2
    connection-timeout: 30000
    idle-timeout: 600000
    max-lifetime: 1800000

features:
  tracking-enabled: true
  welcome-messages: true
  cross-platform: true
  server-status: true

servers:
  hub:
    display-name: "Hub"
    spawn-location:
      world: "world"
      x: 0.0
      y: 100.0
      z: 0.0
      yaw: 0.0
      pitch: 0.0
  
  anarchy:
    display-name: "Anarchy"
    spawn-location:
      world: "world"
      x: 0.0
      y: 64.0
      z: 0.0
      yaw: 0.0
      pitch: 0.0
  
  civilization:
    display-name: "Civilization"
    spawn-location:
      world: "world"
      x: 0.0
      y: 64.0
      z: 0.0
      yaw: 0.0
      pitch: 0.0
  
  arena:
    display-name: "Arena"
    spawn-location:
      world: "world"
      x: 0.0
      y: 64.0
      z: 0.0
      yaw: 0.0
      pitch: 0.0
  
  parkour:
    display-name: "Parkour"
    spawn-location:
      world: "world"
      x: 0.0
      y: 64.0
      z: 0.0
      yaw: 0.0
      pitch: 0.0

permissions:
  player-info: "bovisgl.tracking.playerinfo"
  welcome: "bovisgl.tracking.welcome"
  online-players: "bovisgl.tracking.online"
  server-status: "bovisgl.tracking.status"
  reload: "bovisgl.tracking.reload"
""".trimIndent()
    
    private fun getDefaultMessages(): String = """
# BovisGL Player Tracking Messages
welcome:
  first-join: "&aWelcome to BovisGL Network, &e{player}&a! This is your first time joining.\n&7Join our Discord: &bhttps://discord.gg/SVNfJZ6Rgz &7| Website: &bhttps://bovisgl.xyz"
  returning: "&aWelcome back to BovisGL Network, &e{player}&a! Last seen: &f{last_seen}"
  
player-info:
  header: "&e=== Player Info for {player} ==="
  uuid: "&7UUID: &f{uuid}"
  first-join: "&7First joined: &f{first_join}"
  last-seen: "&7Last seen: &f{last_seen}"
  playtime: "&7Total playtime: &f{playtime}"
  current-server: "&7Current server: &f{server}"
  
server-status:
  header: "&e=== Server Status ==="
  server-line: "&7{server}: &f{online}/{max} players"
  total-line: "&7Total: &f{total} players online"
  
error:
  no-permission: "&cYou don't have permission to use this command!"
  player-not-found: "&cPlayer not found!"
  database-error: "&cDatabase error occurred! Please try again later."
  
info:
  config-reloaded: "&aConfiguration reloaded successfully!"
""".trimIndent()
}
