package anarchy.bovisgl

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory
import com.fasterxml.jackson.module.kotlin.KotlinModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import net.minecraft.server.MinecraftServer
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.slf4j.LoggerFactory
import java.io.File
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class ProxyRegistration {
    
    private val logger = LoggerFactory.getLogger("BovisGL-Anarchy-ProxyReg")
    private val JSON = "application/json; charset=utf-8".toMediaType()
    
    private val httpClient: OkHttpClient
    private val yamlMapper: ObjectMapper
    private val jsonMapper: ObjectMapper = ObjectMapper().registerModule(KotlinModule())
    private var config: ProxyConfig
    private var heartbeatExecutor: ScheduledExecutorService? = null
    private val startTime = System.currentTimeMillis()
    
    init {
        httpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()
            
    yamlMapper = ObjectMapper(YAMLFactory()).registerKotlinModule()
    config = loadConfig()
    }
    
    private fun loadConfig(): ProxyConfig {
        return try {
            val configFile = File("config/bovisgl-anarchy.yml")
            if (!configFile.exists()) {
                createDefaultConfig(configFile)
            }
            
            yamlMapper.readValue(configFile, ProxyConfig::class.java).also {
                logger.info("Loaded proxy configuration: ${it.proxy.url}")
            }
        } catch (e: Exception) {
            logger.warn("Failed to load config, using defaults: ${e.message}")
            ProxyConfig()
        }
    }
    
    private fun createDefaultConfig(configFile: File) {
        configFile.parentFile.mkdirs()
        
        val defaultConfig = ProxyConfig()
    yamlMapper.writeValue(configFile, defaultConfig)
        
        logger.info("Created default configuration at: ${configFile.absolutePath}")
    }
    
    fun registerWithProxy(serverName: String, server: MinecraftServer): CompletableFuture<Void> {
        return CompletableFuture.runAsync {
            var attempt = 0
            while (true) {
                attempt++
                try {
                    logger.info("[registration] Attempt #$attempt to connect to communications service at ${config.proxy.url}")
                    val registrationData = mapOf(
                        "serverName" to serverName,
                        "serverType" to "anarchy",
                        "host" to config.proxy.server.host,
                        "port" to config.proxy.server.port,
                        "maxPlayers" to server.maxPlayerCount,
                        "currentPlayers" to server.currentPlayerCount,
                        "status" to "online",
                        "version" to server.version,
                        "timestamp" to System.currentTimeMillis()
                    )
                    val json = jsonMapper.writeValueAsString(registrationData)
                    val body = json.toRequestBody(JSON)
                    val request = Request.Builder()
                        .url("${config.proxy.url}/api/servers/register")
                        .post(body)
                        .build()
                    httpClient.newCall(request).execute().use { response ->
                        if (response.isSuccessful) {
                            logger.info("[registration] SUCCESS after #$attempt attempts for '$serverName'")
                            startHeartbeat(serverName, server)
                            return@runAsync
                        } else {
                            logger.warn("[registration] Failure #$attempt: HTTP ${response.code} - ${response.message}")
                        }
                    }
                } catch (e: Exception) {
                    logger.warn("[registration] Exception on attempt #$attempt: ${e.message}")
                }
                try {
                    Thread.sleep(30_000)
                } catch (_: InterruptedException) {
                    logger.info("[registration] Retry loop interrupted, stopping attempts")
                    return@runAsync
                }
            }
        }
    }
    
    fun unregisterFromProxy(serverName: String): CompletableFuture<Void> {
        return CompletableFuture.runAsync {
            try {
                stopHeartbeat()
                
                val data = mapOf(
                    "serverName" to serverName
                )
                
                val json = jsonMapper.writeValueAsString(data)
                val body = json.toRequestBody(JSON)
                val request = Request.Builder()
                    .url("${config.proxy.url}/api/servers/unregister")
                    .post(body)
                    .build()
                
                httpClient.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        logger.info("Successfully unregistered '$serverName' from proxy")
                    } else {
                        logger.warn("Failed to unregister from proxy: ${response.code} - ${response.message}")
                    }
                }
                
            } catch (e: Exception) {
                logger.error("Error unregistering from proxy", e)
            }
        }
    }
    
    private fun startHeartbeat(serverName: String, server: MinecraftServer) {
        stopHeartbeat() // Stop any existing heartbeat
        
        heartbeatExecutor = Executors.newSingleThreadScheduledExecutor { r ->
            Thread(r, "BovisGL-Heartbeat").apply { isDaemon = true }
        }
        
        heartbeatExecutor?.scheduleAtFixedRate({
            sendHeartbeat(serverName, server)
        }, config.proxy.heartbeatInterval.toLong(), config.proxy.heartbeatInterval.toLong(), TimeUnit.SECONDS)
        
        logger.info("Started heartbeat with interval: ${config.proxy.heartbeatInterval}s")
    }
    
    private fun stopHeartbeat() {
        heartbeatExecutor?.shutdown()
        heartbeatExecutor = null
    }
    
    private fun sendHeartbeat(serverName: String, server: MinecraftServer) {
        try {
            val heartbeatData = mapOf(
                "serverName" to serverName,
                "status" to "online", 
                "playerCount" to server.currentPlayerCount,
                "maxPlayers" to server.maxPlayerCount,
                "uptime" to (System.currentTimeMillis() - startTime),
                "version" to server.version,
                "lastSeen" to System.currentTimeMillis()
            )
            
            val json = jsonMapper.writeValueAsString(heartbeatData)
            val body = json.toRequestBody(JSON)
            val request = Request.Builder()
                .url("${config.proxy.url}/api/servers/heartbeat")
                .post(body)
                .build()
            
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    logger.debug("Heartbeat failed: ${response.code} - ${response.message}")
                }
            }
            
        } catch (e: Exception) {
            logger.debug("Error sending heartbeat: ${e.message}")
        }
    }
    
    /**
     * Configuration classes
     */
    data class ProxyConfig(
        val proxy: ProxySettings = ProxySettings(),
        val worlds: WorldSettings = WorldSettings(),
        val logging: LoggingSettings = LoggingSettings()
    )
    
    data class ProxySettings(
    val url: String = (System.getenv("BOVISGL_COMMS") ?: "http://localhost:3456"),
        val apiKey: String = "bovisgl-anarchy-key",
        val server: ServerSettings = ServerSettings(),
        val heartbeatInterval: Int = 30
    )
    
    data class ServerSettings(
        val host: String = "localhost",
        val port: Int = 25566
    )
    
    data class WorldSettings(
        val enableRegistration: Boolean = true,
        val mainWorld: String = "anarchy_overworld",
        val displayNames: Map<String, String> = mapOf(
            "anarchy_overworld" to "Anarchy Overworld",
            "anarchy_nether" to "Anarchy Nether",
            "anarchy_end" to "Anarchy End"
        )
    )
    
    data class LoggingSettings(
        val level: String = "INFO",
        val logProxyRequests: Boolean = false,
        val logWorldRegistry: Boolean = false
    )
}
