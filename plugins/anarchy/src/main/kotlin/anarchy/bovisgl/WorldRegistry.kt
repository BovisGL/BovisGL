package anarchy.bovisgl

import net.minecraft.server.MinecraftServer
import net.minecraft.server.world.ServerWorld
import net.minecraft.util.Identifier
import net.minecraft.registry.RegistryKey
import net.minecraft.world.World
import org.slf4j.LoggerFactory

class WorldRegistry {
    
    private val logger = LoggerFactory.getLogger("BovisGL-Anarchy-WorldRegistry")
    
    private var server: MinecraftServer? = null
    private val worlds = mutableMapOf<String, WorldInfo>()
    
    fun initialize(server: MinecraftServer) {
        this.server = server
        logger.info("Initializing world registry for anarchy server...")
        
        // Register all available worlds
        registerWorlds()
        
        logger.info("World registry initialized with ${worlds.size} worlds")
    }
    
    private fun registerWorlds() {
        // Disabled: Plugin should not alter or force-load worlds
        // World loading should be handled entirely by Minecraft/mods
        logger.info("World registration disabled - using Minecraft's native world loading")
    }
    
    private fun registerWorld(name: String, world: ServerWorld, displayName: String, isMain: Boolean) {
        val key = world.registryKey
        val dimension = key.value
        
        val info = WorldInfo(
            name,
            displayName,
            dimension.toString(),
            isMain,
            world.players.size
        )
        
        worlds[name] = info
        logger.debug("Registered world: $displayName ($dimension)")
    }
    
    fun getWorlds(): Map<String, WorldInfo> = worlds.toMap()
    
    fun getMainWorld(): WorldInfo? {
        return worlds.values.find { it.isMain }
    }
    
    fun getWorldNames(): Set<String> = worlds.keys
    
    fun getTotalPlayerCount(): Int {
        return server?.currentPlayerCount ?: 0
    }
    
    fun updatePlayerCounts() {
        val server = this.server ?: return
        
        worlds.forEach { (name, info) ->
            val world = getServerWorldByName(name)
            if (world != null) {
                info.playerCount = world.players.size
            }
        }
    }
    
    private fun getServerWorldByName(name: String): ServerWorld? {
        val server = this.server ?: return null
        
        return when (name) {
            "anarchy_overworld" -> server.overworld
            "anarchy_nether" -> server.getWorld(World.NETHER)
            "anarchy_end" -> server.getWorld(World.END)
            else -> null
        }
    }
    
    /**
     * World information container
     */
    data class WorldInfo(
        val name: String,
        val displayName: String,
        val dimension: String,
        val isMain: Boolean,
        var playerCount: Int
    ) {
        override fun toString(): String {
            return "WorldInfo(name='$name', displayName='$displayName', dimension='$dimension', isMain=$isMain, playerCount=$playerCount)"
        }
    }
}
