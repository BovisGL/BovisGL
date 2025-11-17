package com.bovisgl.parkour

import com.bovisgl.parkour.monitoring.ParkourMonitoringService
import com.bovisgl.parkour.forcespawn.ForceSpawnManager
import org.bukkit.command.Command
import org.bukkit.command.CommandSender
import java.net.HttpURLConnection
import java.net.URL
import com.google.gson.Gson
import java.nio.charset.StandardCharsets
import org.bukkit.plugin.java.JavaPlugin
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.EventHandler
import org.bukkit.Bukkit
import org.bukkit.GameMode
import org.bukkit.Material
import org.bukkit.NamespacedKey
import org.bukkit.event.EventPriority
import org.bukkit.event.player.PlayerInteractEvent
import org.bukkit.event.entity.ProjectileLaunchEvent
import org.bukkit.event.entity.EntityDamageByEntityEvent
import org.bukkit.event.player.PlayerDropItemEvent
import org.bukkit.event.player.PlayerSwapHandItemsEvent
import org.bukkit.inventory.ItemStack
import org.bukkit.inventory.meta.ItemMeta
import org.bukkit.inventory.ItemFlag
import org.bukkit.persistence.PersistentDataType
import org.bukkit.metadata.FixedMetadataValue
import org.bukkit.util.Vector
import org.bukkit.entity.Player

/**
 * BovisGL Parkour Plugin - monitoring + lobby (force spawn, custom items)
 */
class BovisGLParkourPlugin : JavaPlugin() {
    private var monitoringService: ParkourMonitoringService? = null
     private var lobby: ParkourLobbyManager? = null
    private var forceSpawnManager: ForceSpawnManager? = null

    override fun onEnable() {
        saveDefaultConfig()
        logger.info("Starting BovisGL Parkour Plugin (monitoring only)...")

        try {
            monitoringService = ParkourMonitoringService(this)
            monitoringService?.start()
            logger.info("Monitoring service initialized successfully")
        } catch (e: Exception) {
            logger.severe("Failed to initialize monitoring service: ${e.message}")
        }

        // Set ForceSpawn defaults
        config.addDefault("forcespawn.enabled", true)
        config.addDefault("forcespawn.delete-player-data", true)
        config.addDefault("forcespawn.delete-player-advancements", false)
        config.addDefault("forcespawn.delete-player-stats", false)
        config.addDefault("forcespawn.delete-player-backups", true)
        config.addDefault("forcespawn.deletion-delay", 2)
        config.addDefault("forcespawn.debug", false)
        config.addDefault("forcespawn.join-message", "")
        config.addDefault("forcespawn.force-teleport-on-join", true)
        config.options().copyDefaults(true)
        saveConfig()

        // Initialize ForceSpawn functionality
        try {
            forceSpawnManager = ForceSpawnManager(this)
            forceSpawnManager?.initialize()
            logger.info("ForceSpawn module initialized successfully (Parkour)")
        } catch (e: Exception) {
            logger.severe("Failed to initialize ForceSpawn module: ${e.message}")
        }

    // Initialize Lobby features
    lobby = ParkourLobbyManager(this)
    lobby?.initialize()

    logger.info("BovisGL Parkour Plugin has been enabled!")
    }

    override fun onDisable() {
        monitoringService?.stop()
    forceSpawnManager?.shutdown()
    lobby = null
        logger.info("BovisGL Parkour Plugin has been disabled!")
    }

    override fun onCommand(sender: CommandSender, command: Command, label: String, args: Array<String>): Boolean {
        when (command.name.lowercase()) {
            "bovisgl-parkour" -> {
                if (args.size == 1 && args[0].equals("reload", true)) {
                    if (!sender.hasPermission("bovisgl.admin.reload")) {
                        sender.sendMessage("§cNo permission.")
                        return true
                    }
                    reloadConfig()
                    forceSpawnManager?.reload()
                    sender.sendMessage("§aConfig reloaded.")
                    return true
                }
            }
            "ban" -> {
                if (!sender.hasPermission("bovisgl.ban")) {
                    sender.sendMessage("§cNo permission.")
                    return true
                }
                if (args.isEmpty()) {
                    sender.sendMessage("§cUsage: /ban <player>")
                    return true
                }
                val target = args[0]
                server.scheduler.runTaskAsynchronously(this, Runnable {
                    val uuid = Bukkit.getOfflinePlayer(target).uniqueId.toString()
                    val payload = mapOf("uuid" to uuid, "name" to target, "reason" to null, "by" to sender.name)
                    val ok = postJson("http://localhost:3456/api/players/ban", payload)
                    sender.sendMessage(if (ok) "§aBanned $target" else "§cFailed to ban $target")
                })
                return true
            }
            "unban" -> {
                if (!sender.hasPermission("bovisgl.unban")) {
                    sender.sendMessage("§cNo permission.")
                    return true
                }
                if (args.isEmpty()) {
                    sender.sendMessage("§cUsage: /unban <player>")
                    return true
                }
                val target = args[0]
                server.scheduler.runTaskAsynchronously(this, Runnable {
                    val payload = mapOf("id" to target)
                    val ok = postJson("http://localhost:3456/api/players/unban", payload)
                    sender.sendMessage(if (ok) "§aUnbanned $target" else "§cFailed to unban or not banned: $target")
                })
                return true
            }
        }
        return false
    }
}

class ParkourLobbyManager(private val plugin: JavaPlugin) : Listener {
    private val KEY_SNOW = NamespacedKey(plugin, "parkour_snowball")
    private val KEY_STICK = NamespacedKey(plugin, "parkour_stick")
    private val COOLDOWN_MS = 3000L
    private val lastUse: MutableMap<java.util.UUID, Long> = mutableMapOf()

    fun initialize() {
        plugin.server.pluginManager.registerEvents(this, plugin)
    }

    @EventHandler(priority = EventPriority.MONITOR)
    fun onJoin(e: PlayerJoinEvent) {
        val p = e.player
        // async join record + ban check
        Bukkit.getScheduler().runTaskAsynchronously(plugin, Runnable {
            val payload = mapOf("uuid" to p.uniqueId.toString(), "name" to p.name)
            val resp = postAndParse("http://localhost:3456/api/players/join", payload)
            if (resp?.get("banned") == true) {
                Bukkit.getScheduler().runTask(plugin, Runnable {
                    p.kickPlayer("You are banned")
                })
            }
        })
        Bukkit.getScheduler().runTaskLater(plugin, Runnable {
            val world = Bukkit.getWorlds()[0]
            p.teleport(world.spawnLocation)
            giveLobbyItems(p)
        }, 10L)
    }

    private fun giveLobbyItems(p: Player) {
        if (p.gameMode != GameMode.CREATIVE) p.inventory.clear()

        val snow = ItemStack(Material.SNOWBALL)
        val sm: ItemMeta = snow.itemMeta
        sm.setDisplayName("§bParkour Snowball §7(3s cooldown)")
        sm.addItemFlags(ItemFlag.HIDE_ATTRIBUTES)
        sm.persistentDataContainer.set(KEY_SNOW, PersistentDataType.BYTE, 1.toByte())
        snow.itemMeta = sm

    val stick = ItemStack(Material.STICK)
        val stm: ItemMeta = stick.itemMeta
        stm.setDisplayName("§dParkour Knockback Stick §7(KB I, 3s cooldown)")
        stm.addItemFlags(ItemFlag.HIDE_ATTRIBUTES)
        stm.persistentDataContainer.set(KEY_STICK, PersistentDataType.BYTE, 1.toByte())
    stick.itemMeta = stm
    // Add Knockback I purely visual; knockback is applied in code without damage
    stick.addUnsafeEnchantment(org.bukkit.enchantments.Enchantment.KNOCKBACK, 1)

        p.inventory.setItem(0, stick)
        p.inventory.setItem(1, snow)
        p.updateInventory()
    }

    private fun canUse(player: Player): Boolean {
        val now = System.currentTimeMillis()
        val last = lastUse[player.uniqueId] ?: 0L
        return now - last >= COOLDOWN_MS
    }

    private fun markUse(player: Player) { lastUse[player.uniqueId] = System.currentTimeMillis() }

    @EventHandler(ignoreCancelled = true)
    fun onInteract(e: PlayerInteractEvent) {
        val item = e.item ?: return
        val p = e.player
        val meta = item.itemMeta ?: return

        if (meta.persistentDataContainer.has(KEY_SNOW, PersistentDataType.BYTE)) {
            if (!canUse(p)) {
                e.isCancelled = true
                val remain = (COOLDOWN_MS - (System.currentTimeMillis() - (lastUse[p.uniqueId] ?: 0L))) / 1000.0
                p.sendActionBar(net.kyori.adventure.text.Component.text("Cooldown ${"%.1f".format(remain)}s"))
                return
            }
            markUse(p)
        }

        if (meta.persistentDataContainer.has(KEY_STICK, PersistentDataType.BYTE)) {
            if (!canUse(p)) {
                e.isCancelled = true
                val remain = (COOLDOWN_MS - (System.currentTimeMillis() - (lastUse[p.uniqueId] ?: 0L))) / 1000.0
                p.sendActionBar(net.kyori.adventure.text.Component.text("Cooldown ${"%.1f".format(remain)}s"))
                return
            }
            markUse(p)
        }
    }

    @EventHandler(ignoreCancelled = true)
    fun onProjectileLaunch(e: ProjectileLaunchEvent) {
        val shooter = e.entity.shooter as? Player ?: return
        val item = shooter.inventory.itemInMainHand
        val meta = item.itemMeta ?: return
        if (meta.persistentDataContainer.has(KEY_SNOW, PersistentDataType.BYTE)) {
            e.entity.setMetadata("parkour_snowball", FixedMetadataValue(plugin, true))
            // Refill snowball after tick if consumed
            Bukkit.getScheduler().runTask(plugin, Runnable {
                if (item.type == Material.SNOWBALL) {
                    val idx = shooter.inventory.heldItemSlot
                    val cur = shooter.inventory.getItem(idx)
                    if (cur == null || cur.type == Material.AIR) {
                        shooter.inventory.setItem(idx, ItemStack(Material.SNOWBALL, 1).apply { this.itemMeta = meta })
                    } else if (cur.type == Material.SNOWBALL) {
                        cur.amount = (cur.amount + 1).coerceAtMost(16)
                        shooter.inventory.setItem(idx, cur)
                    }
                    shooter.updateInventory()
                }
            })
        }
    }

    @EventHandler(ignoreCancelled = true, priority = EventPriority.HIGH)
    fun onDamage(e: EntityDamageByEntityEvent) {
        val victim = e.entity as? Player ?: return
        val damagerPlayer: Player? = when (val d = e.damager) {
            is Player -> d
            is org.bukkit.entity.Projectile -> (d.shooter as? Player)
            else -> null
        }
        e.isCancelled = true // disable general PvP

        if (damagerPlayer != null) {
            val held = damagerPlayer.inventory.itemInMainHand
            val heldMeta = held.itemMeta
            if (heldMeta != null && heldMeta.persistentDataContainer.has(KEY_STICK, PersistentDataType.BYTE)) {
                applyKnockback(victim, damagerPlayer.location.direction)
                e.damage = 0.0
                return
            }
            val proj = e.damager as? org.bukkit.entity.Projectile
            if (proj != null && proj.hasMetadata("parkour_snowball")) {
                applyKnockback(victim, proj.velocity.normalize())
                e.damage = 0.0
                return
            }
        }
    }

    private fun applyKnockback(victim: Player, dir: Vector) {
        val kb = dir.clone().normalize().multiply(0.6).setY(0.35)
        victim.velocity = victim.velocity.add(kb)
    }

    @EventHandler(ignoreCancelled = true)
    fun onDrop(e: PlayerDropItemEvent) {
        val meta = e.itemDrop.itemStack.itemMeta ?: return
        if (meta.persistentDataContainer.has(KEY_SNOW, PersistentDataType.BYTE) ||
            meta.persistentDataContainer.has(KEY_STICK, PersistentDataType.BYTE)) {
            e.isCancelled = true
        }
    }

    @EventHandler(ignoreCancelled = true)
    fun onSwap(e: PlayerSwapHandItemsEvent) {
        val main = e.mainHandItem?.itemMeta
        val off = e.offHandItem?.itemMeta
        if ((main != null && (main.persistentDataContainer.has(KEY_SNOW, PersistentDataType.BYTE) || main.persistentDataContainer.has(KEY_STICK, PersistentDataType.BYTE))) ||
            (off != null && (off.persistentDataContainer.has(KEY_SNOW, PersistentDataType.BYTE) || off.persistentDataContainer.has(KEY_STICK, PersistentDataType.BYTE)))) {
            e.isCancelled = true
        }
    }
}

private val gson = Gson()

private fun postJson(urlStr: String, payload: Any): Boolean {
    return try {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        val json = gson.toJson(payload)
        conn.outputStream.use { it.write(json.toByteArray(StandardCharsets.UTF_8)) }
        conn.responseCode in 200..299
    } catch (e: Exception) { false }
}

@Suppress("UNCHECKED_CAST")
private fun postAndParse(urlStr: String, payload: Any): Map<String, Any?>? {
    return try {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        val json = gson.toJson(payload)
        conn.outputStream.use { it.write(json.toByteArray(StandardCharsets.UTF_8)) }
        val text = conn.inputStream.bufferedReader().use { it.readText() }
        gson.fromJson(text, Map::class.java) as Map<String, Any?>
    } catch (e: Exception) { null }
}
