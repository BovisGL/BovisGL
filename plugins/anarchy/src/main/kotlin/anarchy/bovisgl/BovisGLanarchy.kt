package anarchy.bovisgl

import net.fabricmc.api.ModInitializer
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents
import net.minecraft.server.MinecraftServer
import org.slf4j.LoggerFactory

object BovisGLanarchy : ModInitializer {
    const val MOD_ID = "bovisgl-anarchy"
    private val logger = LoggerFactory.getLogger(MOD_ID)
    
    private lateinit var proxyRegistration: ProxyRegistration
    
    override fun onInitialize() {
        logger.info("Initializing BovisGL Anarchy Mod...")
        
        // Initialize proxy registration
        proxyRegistration = ProxyRegistration()
        
        // Register vanilla ban command blockers (disable /ban, /pardon, etc)
        try {
            registerVanillaBanBlockers()
            logger.info("Vanilla ban commands disabled - all ban management handled by proxy")
        } catch (e: Exception) {
            logger.warn("Failed to disable vanilla ban commands: ${e.message}")
        }
        
        // Register server lifecycle events
        ServerLifecycleEvents.SERVER_STARTING.register { server ->
            onServerStarting(server)
        }
        
        ServerLifecycleEvents.SERVER_STARTED.register { server ->
            onServerStarted(server)
        }
        
        ServerLifecycleEvents.SERVER_STOPPING.register { server ->
            onServerStopping(server)
        }

        logger.info("BovisGL Anarchy Mod initialized successfully!")
    }
    
    private fun onServerStarting(server: MinecraftServer) {
        logger.info("Anarchy server starting...")
    }
    
    private fun onServerStarted(server: MinecraftServer) {
        logger.info("Anarchy server started - registering with proxy...")
        
        // Register anarchy world with proxy
        try {
            proxyRegistration.registerWithProxy("anarchy", server)
            logger.info("Successfully registered anarchy world with BovisGL proxy")
        } catch (e: Exception) {
            logger.error("Failed to register with proxy: ${e.message}", e)
        }
    }
    
    private fun onServerStopping(server: MinecraftServer) {
        logger.info("Anarchy server stopping - unregistering from proxy...")
        
        try {
            proxyRegistration.unregisterFromProxy("anarchy")
            logger.info("Successfully unregistered from BovisGL proxy")
        } catch (e: Exception) {
            logger.error("Failed to unregister from proxy: ${e.message}", e)
        }
    }
    
    fun getProxyRegistration(): ProxyRegistration = proxyRegistration
}
