package com.bovisgl.proxy

// Old BanManager removed; using centralized communications service for bans
import com.bovisgl.proxy.tracking.PlayerTracker
import com.bovisgl.proxy.client.ClientDetectListener
import com.bovisgl.proxy.tracking.PlayerOriginTracker
import com.bovisgl.proxy.commands.CommandManager
import com.bovisgl.proxy.welcome.WelcomeMessageManager
import com.bovisgl.proxy.monitoring.ProxyMonitoringService
import com.bovisgl.proxy.api.KickPlayerEndpoint
import com.google.inject.Inject
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent
import com.velocitypowered.api.plugin.Plugin
import com.velocitypowered.api.plugin.annotation.DataDirectory
import com.velocitypowered.api.proxy.ProxyServer
import org.slf4j.Logger
import java.nio.file.Path
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.Executors

/**
 * BovisGL Proxy Plugin - Main plugin for Velocity proxy in the BovisGL network
 * 
 * This plugin combines functionality from:
 * - Ban System: Network-wide ban management with database persistence
 * - Player Tracking: Cross-server player activity monitoring
 * - Player Origin Tracking: Tracks which server players came from for spawn selection
 * - Network Management: Hub switching, cross-platform features
 */
@Plugin(
    id = "bovisgl-proxy",
    name = "BovisGL Proxy Plugin",
    version = "1.0.0",
    description = "Network management and moderation for BovisGL Velocity proxy",
    authors = ["BovisGL"]
)
class BovisGLProxyPlugin @Inject constructor(
    private val server: ProxyServer,
    private val logger: Logger,
    @DataDirectory private val dataDirectory: Path
) {
    
    // No local ban manager; bans handled by communications service
    private var playerTracker: PlayerTracker? = null
    private var playerOriginTracker: PlayerOriginTracker? = null
    private var commandManager: CommandManager? = null
    private var welcomeMessageManager: WelcomeMessageManager? = null
    private var monitoringService: ProxyMonitoringService? = null
    private var executorService: ScheduledExecutorService? = null
    private var chatGuiForwarder: ChatGuiForwarder? = null
    private var clientDetectListener: ClientDetectListener? = null
    private var kickPlayerEndpoint: KickPlayerEndpoint? = null
    
    @Subscribe
    fun onProxyInitialization(event: ProxyInitializeEvent) {
        try {
            logger.info("Initializing BovisGL Proxy Plugin...")
            
            // Initialize executor service
            executorService = Executors.newScheduledThreadPool(4)
            
            // Register client detection listener (brand/protocol/bedrock) - must be before ban listener
            clientDetectListener = ClientDetectListener(server, logger)
            server.eventManager.register(this, clientDetectListener!!)
            logger.info("Client detection listener registered")
            
            // Ban manager removed; bans are now centralized via communications API
            server.eventManager.register(this, ProxyBanListener(logger, clientDetectListener!!))
            logger.info("Registered proxy ban listener (communications centralized ban system)")
            
            // Initialize player origin tracker
            playerOriginTracker = PlayerOriginTracker(server)
            server.eventManager.register(this, playerOriginTracker!!)
            logger.info("Player origin tracker initialized successfully")
            
            // Initialize command manager for server connection commands
            commandManager = CommandManager(server, logger)
            commandManager?.registerCommands()
            logger.info("Server connection commands registered successfully")
            
            // Initialize welcome message manager
            welcomeMessageManager = WelcomeMessageManager(logger, clientDetectListener!!)
            server.eventManager.register(this, welcomeMessageManager!!)
            logger.info("Welcome message system initialized successfully")

            // Initialize player tracker (communications sync only)
            playerTracker = PlayerTracker(server, java.util.logging.Logger.getLogger("PlayerTracker"), clientDetectListener!!)
            playerTracker?.initialize()
            server.eventManager.register(this, playerTracker!!)
            logger.info("Player tracker initialized successfully")

            // Initialize monitoring service for web dashboard
            monitoringService = ProxyMonitoringService(server, logger, executorService!!)
            monitoringService?.start()
            logger.info("Monitoring service initialized successfully")

            // Initialize kick player endpoint for remote ban kicks from communications service
            kickPlayerEndpoint = KickPlayerEndpoint(server, logger)
            kickPlayerEndpoint?.start()
            logger.info("Kick player API endpoint initialized successfully")

            // Chat GUI forwarder registration removed to disable the custom double-tap chat UI
            // chatGuiForwarder = ChatGuiForwarder(server, logger)
            // server.eventManager.register(this, chatGuiForwarder!!)
            
            logger.info("BovisGL Proxy Plugin has been enabled!")
            
        } catch (e: Exception) {
            logger.error("Failed to initialize BovisGL Proxy Plugin", e)
        }
    }
    
    @Subscribe
    fun onProxyShutdown(event: ProxyShutdownEvent) {
        try {
            logger.info("Shutting down BovisGL Proxy Plugin...")
            
            // No ban manager to shutdown (centralized communications system)
            
            // Shutdown kick player endpoint
            kickPlayerEndpoint?.stop()
            
            // Shutdown monitoring service
            monitoringService?.stop()
            // No explicit shutdown needed for clientDetectListener
            
            // Shutdown player tracker
            playerTracker?.shutdown()
            
            // Shutdown executor service
            executorService?.shutdown()
            
            logger.info("BovisGL Proxy Plugin has been disabled!")
            
        } catch (e: Exception) {
            logger.error("Error during plugin shutdown", e)
        }
    }
    
    /**
     * Get the ban manager instance
     */
    // getBanManager removed
    
    /**
     * Get the player tracker instance
     */
    fun getPlayerTracker(): PlayerTracker? = playerTracker
    
    /**
     * Get the player origin tracker instance
     */
    fun getPlayerOriginTracker(): PlayerOriginTracker? = playerOriginTracker
    
    /**
     * Get the proxy server instance
     */
    fun getProxyServer(): ProxyServer = server
    
    /**
     * Get the logger instance
     */
    fun getPluginLogger(): Logger = logger
    
    /**
     * Get the data directory
     */
    fun getDataDirectory(): Path = dataDirectory
    
    /**
     * Get the executor service
     */
    fun getExecutorService(): ScheduledExecutorService? = executorService
}
