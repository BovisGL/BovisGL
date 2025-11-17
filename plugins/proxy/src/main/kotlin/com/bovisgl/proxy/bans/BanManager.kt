package com.bovisgl.proxy.bans

import com.bovisgl.proxy.BovisGLProxyPlugin
import com.bovisgl.proxy.bans.config.BanConfigManager
import com.bovisgl.proxy.bans.database.BanDatabaseManager
import com.bovisgl.proxy.bans.service.BanService
import com.bovisgl.proxy.bans.service.WebsiteExportService
import com.bovisgl.proxy.bans.listener.BanConnectionListener
import com.bovisgl.proxy.bans.command.*
import com.velocitypowered.api.proxy.ProxyServer
import org.slf4j.Logger
import java.nio.file.Path
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Ban Manager - Handles network-wide ban system for Velocity proxy
 * 
 * Features:
 * - UUID-based ban storage with database persistence
 * - Flexible duration system (hours, days, weeks, permanent)
 * - Real-time ban checking on player connection
 * - Ban history tracking and audit trail
 * - Website integration with JSON export
 * - Cross-server ban enforcement
 */
class BanManager(
    private val plugin: BovisGLProxyPlugin,
    private val server: ProxyServer,
    private val logger: Logger,
    private val dataDirectory: Path,
    private val executorService: ScheduledExecutorService
) {
    
    private lateinit var configManager: BanConfigManager
    private lateinit var databaseManager: BanDatabaseManager
    private lateinit var banService: BanService
    private lateinit var websiteExportService: WebsiteExportService
    private lateinit var connectionListener: BanConnectionListener
    
    fun initialize() {
        try {
            logger.info("Initializing Ban Manager...")
            
            // Initialize configuration
            configManager = BanConfigManager(dataDirectory)
            configManager.loadConfig()
            configManager.loadMessages()
            logger.info("Ban configuration loaded successfully")
            
            // Initialize database
            databaseManager = when (configManager.getDatabaseType()) {
                "sqlite" -> BanDatabaseManager.createSqliteManager(
                    databaseFile = configManager.getSqliteFile(),
                    maxPoolSize = configManager.getMaxPoolSize(),
                    minIdle = configManager.getMinIdle(),
                    connectionTimeout = configManager.getConnectionTimeout(),
                    idleTimeout = configManager.getIdleTimeout(),
                    maxLifetime = configManager.getMaxLifetime()
                )
                "postgresql" -> BanDatabaseManager.createPostgreSqlManager(
                    host = configManager.getDatabaseHost(),
                    port = configManager.getDatabasePort(),
                    database = configManager.getDatabaseName(),
                    username = configManager.getDatabaseUsername(),
                    password = configManager.getDatabasePassword(),
                    autoCreate = configManager.getDatabaseAutoCreate(),
                    maxPoolSize = configManager.getMaxPoolSize(),
                    minIdle = configManager.getMinIdle(),
                    connectionTimeout = configManager.getConnectionTimeout(),
                    idleTimeout = configManager.getIdleTimeout(),
                    maxLifetime = configManager.getMaxLifetime()
                )
                else -> {
                    logger.error("Unsupported database type: ${configManager.getDatabaseType()}. Supported types: sqlite, postgresql")
                    throw IllegalArgumentException("Unsupported database type: ${configManager.getDatabaseType()}")
                }
            }
            databaseManager.initialize()
            logger.info("Ban database initialized successfully")
            
            // Initialize services
            banService = BanService(databaseManager, configManager, server)
            websiteExportService = WebsiteExportService(configManager, databaseManager)
            logger.info("Ban services initialized successfully")
            
            // Initialize listener
            connectionListener = BanConnectionListener(banService, configManager)
            server.eventManager.register(plugin, connectionListener)
            logger.info("Ban connection listener registered successfully")
            
            // Register commands
            registerCommands()
            logger.info("Ban commands registered successfully")
            
            // Schedule website export task if enabled
            if (configManager.isWebsiteExportEnabled()) {
                val exportInterval = configManager.getWebsiteExportInterval()
                executorService.scheduleAtFixedRate({
                    try {
                        websiteExportService.exportBans()
                        logger.debug("Website export completed successfully")
                    } catch (e: Exception) {
                        logger.error("Error during website export", e)
                    }
                }, exportInterval, exportInterval, TimeUnit.MINUTES)
                logger.info("Website export scheduled every $exportInterval minutes")
            }
            
            // Schedule cleanup task
            val cleanupInterval = configManager.getCleanupInterval()
            executorService.scheduleAtFixedRate({
                try {
                    val cleaned = banService.cleanupExpiredBans()
                    if (cleaned > 0) {
                        logger.info("Cleaned up $cleaned expired bans")
                    }
                } catch (e: Exception) {
                    logger.error("Error during ban cleanup", e)
                }
            }, cleanupInterval, cleanupInterval, TimeUnit.MINUTES)
            logger.info("Ban cleanup scheduled every $cleanupInterval minutes")
            
            logger.info("Ban Manager initialized successfully")
            
        } catch (e: Exception) {
            logger.error("Failed to initialize Ban Manager", e)
            throw e
        }
    }
    
    fun shutdown() {
        try {
            logger.info("Shutting down Ban Manager...")
            
            // Unregister listener
            server.eventManager.unregisterListener(plugin, connectionListener)
            
            // Cleanup database
            databaseManager.close()
            
            logger.info("Ban Manager shutdown complete")
            
        } catch (e: Exception) {
            logger.error("Error during Ban Manager shutdown", e)
        }
    }
    
    private fun registerCommands() {
        // Register ban commands
        val banCommand = BanCommand(banService, configManager, server)
        val pardonCommand = PardonCommand(banService, configManager, server)
        val banListCommand = BanListCommand(banService, configManager)
        val banInfoCommand = BanInfoCommand(banService, configManager, server)
        val banHistoryCommand = BanHistoryCommand(banService, configManager, server)
        val banReloadCommand = BanReloadCommand(configManager)
        val banHelpCommand = BanHelpCommand(configManager)
        
        // Register commands with Velocity
        server.commandManager.register("ban", banCommand)
        server.commandManager.register("pardon", pardonCommand)
        server.commandManager.register("banlist", banListCommand)
        server.commandManager.register("baninfo", banInfoCommand)
        server.commandManager.register("banhistory", banHistoryCommand)
        server.commandManager.register("banreload", banReloadCommand)
        server.commandManager.register("banhelp", banHelpCommand)
        
        // Register alternative aliases
        server.commandManager.register("unban", pardonCommand)
        server.commandManager.register("bans", banListCommand)
    }
    
    /**
     * Get the ban service
     */
    fun getBanService(): BanService = banService
    
    /**
     * Get the ban configuration manager
     */
    fun getConfigManager(): BanConfigManager = configManager
    
    /**
     * Get the ban database manager
     */
    fun getDatabaseManager(): BanDatabaseManager = databaseManager
    
    /**
     * Get the website export service
     */
    fun getWebsiteExportService(): WebsiteExportService = websiteExportService
}
