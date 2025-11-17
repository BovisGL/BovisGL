package com.bovisgl.proxy.bans.config

import org.yaml.snakeyaml.Yaml
import java.io.File
import java.io.FileReader
import java.io.FileWriter
import java.nio.file.Path

class BanConfigManager(private val dataDirectory: Path) {
    
    private val yaml = Yaml()
    private var config: Map<String, Any> = emptyMap()
    private var messages: Map<String, Any> = emptyMap()
    
    fun loadConfig() {
        try {
            val configFile = dataDirectory.resolve("bans-config.yml").toFile()
            if (!configFile.exists()) {
                copyDefaultConfig(configFile)
            }
            
            FileReader(configFile).use { reader ->
                config = yaml.load(reader) ?: emptyMap()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to load bans-config.yml", e)
        }
    }
    
    fun loadMessages() {
        try {
            val messagesFile = dataDirectory.resolve("ban-messages.yml").toFile()
            if (!messagesFile.exists()) {
                copyDefaultMessages(messagesFile)
            }
            
            FileReader(messagesFile).use { reader ->
                messages = yaml.load(reader) ?: emptyMap()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to load ban-messages.yml", e)
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
    fun getDatabaseName(): String = config["database.name"] as? String ?: "bovisgl_bans"
    fun getDatabaseUsername(): String = config["database.username"] as? String ?: "root"
    fun getDatabasePassword(): String = config["database.password"] as? String ?: ""
    fun getDatabaseAutoCreate(): Boolean = config["database.auto-create"] as? Boolean ?: true
    fun getSqliteFile(): File {
        // Redirect SQLite storage to central communications service data directory for unification
        // Get the working directory where the proxy server runs (servers/proxy)
        // Then navigate to communications data from there: ../../communications/src/data/bans.db
        val workingDir = File(System.getProperty("user.dir"))
        val centralPath = File(workingDir, "../../communications/src/data/bans.db").canonicalFile
        return centralPath
    }
    
    // Connection pool settings
    fun getMaxPoolSize(): Int = config["database.connection-pool.max-pool-size"] as? Int ?: 10
    fun getMinIdle(): Int = config["database.connection-pool.min-idle"] as? Int ?: 2
    fun getConnectionTimeout(): Long = config["database.connection-pool.connection-timeout"] as? Long ?: 30000L
    fun getIdleTimeout(): Long = config["database.connection-pool.idle-timeout"] as? Long ?: 600000L
    fun getMaxLifetime(): Long = config["database.connection-pool.max-lifetime"] as? Long ?: 1800000L
    
    // Feature configuration
    fun isKickOnBan(): Boolean = config["features.kick-on-ban"] as? Boolean ?: true
    fun isNotifyStaffOnBan(): Boolean = config["features.notify-staff-on-ban"] as? Boolean ?: true
    fun isLogToConsole(): Boolean = config["features.log-to-console"] as? Boolean ?: true
    fun isLogToFile(): Boolean = config["features.log-to-file"] as? Boolean ?: true
    fun isWebsiteExportEnabled(): Boolean = config["features.website-export"] as? Boolean ?: false
    
    // Interval configuration
    fun getWebsiteExportInterval(): Long = config["intervals.website-export"] as? Long ?: 5L
    fun getCleanupInterval(): Long = config["intervals.cleanup"] as? Long ?: 60L
    
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
# BovisGL Bans Configuration
database:
  type: "sqlite"  # sqlite or postgresql
  host: "localhost"
  port: 5432
  name: "bovisgl_bans"
  username: "root"
  password: ""
  auto-create: true
  sqlite-file: "bans.db"
  
  connection-pool:
    max-pool-size: 10
    min-idle: 2
    connection-timeout: 30000
    idle-timeout: 600000
    max-lifetime: 1800000

features:
  kick-on-ban: true
  notify-staff-on-ban: true
  log-to-console: true
  log-to-file: true
  website-export: false

intervals:
  website-export: 5  # minutes
  cleanup: 60  # minutes

permissions:
  ban: "bovisgl.bans.ban"
  pardon: "bovisgl.bans.pardon"
  baninfo: "bovisgl.bans.info"
  banlist: "bovisgl.bans.list"
  banhistory: "bovisgl.bans.history"
  reload: "bovisgl.bans.reload"
  help: "bovisgl.bans.help"
""".trimIndent()
    
    private fun getDefaultMessages(): String = """
# BovisGL Ban Messages
ban:
  success: "&aSuccessfully banned &e{player} &afor &e{reason}"
  already-banned: "&c{player} is already banned!"
  invalid-duration: "&cInvalid duration format!"
  
pardon:
  success: "&aSuccessfully unbanned &e{player}"
  not-banned: "&c{player} is not banned!"
  
kick:
  banned-permanent: "&cYou have been permanently banned from BovisGL\\n\\n&eReason: &f{reason}\\n&eBanned by: &f{staff}\\n\\n&cAppeal at: https://discord.gg/SVNfJZ6Rgz"
  banned-temporary: "&cYou have been banned from BovisGL\\n\\n&eReason: &f{reason}\\n&eBanned by: &f{staff}\\n&eExpires: &f{expires}\\n\\n&cAppeal at: https://discord.gg/SVNfJZ6Rgz"
  
error:
  no-permission: "&cYou don't have permission to use this command!"
  player-not-found: "&cPlayer not found!"
  invalid-syntax: "&cInvalid syntax! Use: {usage}"
  database-error: "&cDatabase error occurred! Please try again later."
  
info:
  ban-info: "&eBan Info for &f{player}:\\n&eReason: &f{reason}\\n&eBanned by: &f{staff}\\n&eBanned at: &f{date}\\n&eExpires: &f{expires}"
  not-banned: "&a{player} is not banned."
""".trimIndent()
}
