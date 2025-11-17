package com.bovisgl.hub

import com.google.gson.Gson
import org.bukkit.Bukkit
import org.bukkit.Location
import org.bukkit.entity.Player
import org.bukkit.potion.PotionEffect
import org.bukkit.potion.PotionEffectType
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import org.bukkit.plugin.java.JavaPlugin
import java.net.HttpURLConnection
import java.net.URL

/**
 * BannedPlayerHandler - Manages the ban screen experience for banned players
 * - Teleports to designated ban location
 * - Applies full blindness effect
 * - Freezes player (applies mining fatigue + prevents movement)
 * - Shows ban message for 15 seconds
 * - Kicks player after 15 seconds
 */
class BannedPlayerHandler(private val plugin: JavaPlugin) {
    private val gson = Gson()
    private val communicationsBase = System.getProperty("bovisgl.communications.base", "http://127.0.0.1:3456")
    private val bannedPlayers = mutableSetOf<String>()
    private val cachedBanInfo = mutableMapOf<String, BanInfo>() // UUID -> Ban info for incoming players
    
    data class BanCheckResponse(val banned: Boolean = false, val ban: Map<String, Any>? = null)
    data class BanInfo(val uuid: String, val name: String, val reason: String?, val bannedBy: String?, val bannedAt: Long)

    /**
     * Check if a player is banned and apply ban screen if they are
     */
    fun checkAndApplyBanScreen(player: Player) {
        plugin.server.scheduler.runTaskAsynchronously(plugin, Runnable {
            try {
                val uuid = player.uniqueId.toString()
                val username = player.name
                
                plugin.logger.info("🔍 [BAN SCREEN] Checking ban status for $username ($uuid)")
                
                // Check ban status via communications service
                val url = URL("$communicationsBase/api/players/$uuid/ban")
                val http = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 2500
                    readTimeout = 2500
                    setRequestProperty("Accept", "application/json")
                }
                
                val responseText = http.inputStream.bufferedReader().use { it.readText() }
                val resp = gson.fromJson(responseText, BanCheckResponse::class.java)
                
                if (resp.banned) {
                    plugin.logger.warning("🚫 [BAN SCREEN] Banned player detected: $username - applying ban screen")
                    val reason = (resp.ban?.get("reason") as? String) ?: "No reason provided"
                    val bannedBy = (resp.ban?.get("banned_by") as? String) ?: "System"
                    val bannedAt = (resp.ban?.get("banned_at") as? Number)?.toLong() ?: 0L
                    
                    // Schedule synchronous tasks on the main thread
                    plugin.server.scheduler.runTask(plugin, Runnable {
                        applyBanScreen(player, reason, bannedBy, bannedAt)
                    })
                }
            } catch (ex: Exception) {
                plugin.logger.warning("[BAN SCREEN] Ban check failed for ${player.name}: ${ex.message}")
            }
        })
    }

    /**
     * Apply the ban screen to a player
     */
    private fun applyBanScreen(player: Player, reason: String, bannedBy: String, bannedAt: Long) {
        if (!player.isOnline) return
        
        plugin.logger.info("⚠️ [BAN SCREEN] Applying ban screen to ${player.name}")
        
        bannedPlayers.add(player.uniqueId.toString())
        
        // Step 1: Teleport to ban location (-129, 123, -501)
        try {
            val world = player.world
            val banLocation = Location(world, -129.0, 123.0, -501.0, 0f, 0f)
            player.teleport(banLocation)
            plugin.logger.info("📍 [BAN SCREEN] Teleported ${player.name} to ban location")
        } catch (e: Exception) {
            plugin.logger.warning("❌ [BAN SCREEN] Failed to teleport ${player.name}: ${e.message}")
        }
        
        // Step 2: Apply blindness effect (complete darkness)
        player.addPotionEffect(PotionEffect(PotionEffectType.BLINDNESS, 20 * 15, 255, false, false))
        
        // Step 3: Apply mining fatigue to prevent interaction/damage
        player.addPotionEffect(PotionEffect(PotionEffectType.MINING_FATIGUE, 20 * 15, 4, false, false))
        
        // Step 4: Prevent movement by setting game mode, and block chat
        player.isInvulnerable = true
        player.isFlying = false
        player.allowFlight = false
        
        // Step 5: Display ban message
        val banMessage = Component.empty()
            .append(Component.text("\n\n", NamedTextColor.RED))
            .append(Component.text("═══════════════════════════════════\n", NamedTextColor.RED))
            .append(Component.text("🚫 YOU ARE BANNED 🚫\n", NamedTextColor.RED))
            .append(Component.text("═══════════════════════════════════\n", NamedTextColor.GRAY))
            .append(Component.text("Reason: ", NamedTextColor.WHITE))
            .append(Component.text(reason, NamedTextColor.YELLOW))
            .append(Component.text("\n", NamedTextColor.GRAY))
            .append(Component.text("Banned by: ", NamedTextColor.WHITE))
            .append(Component.text(bannedBy, NamedTextColor.YELLOW))
            .append(Component.text("\n", NamedTextColor.GRAY))
            .append(Component.text("═══════════════════════════════════\n", NamedTextColor.RED))
            .append(Component.text("You will be disconnected in 15 seconds.\n", NamedTextColor.YELLOW))
            .append(Component.text("═══════════════════════════════════\n\n", NamedTextColor.RED))
        
        player.sendMessage(banMessage)
        
        // Step 6: Schedule kick after 15 seconds
        plugin.server.scheduler.scheduleSyncDelayedTask(plugin, {
            if (player.isOnline) {
                plugin.logger.info("⏱️ [BAN SCREEN] 15 seconds expired - kicking ${player.name}")
                player.kick(Component.text("You have been disconnected. You are banned from this server.", NamedTextColor.RED))
                bannedPlayers.remove(player.uniqueId.toString())
            }
        }, 20 * 15) // 15 seconds = 300 ticks
    }

    /**
     * Check if a player UUID is currently in the ban screen
     */
    fun isBannedPlayerActive(uuid: String): Boolean = bannedPlayers.contains(uuid)

    /**
     * Remove a player from the active ban list (called on disconnect)
     */
    fun removeBannedPlayer(uuid: String) {
        bannedPlayers.remove(uuid)
    }
}
