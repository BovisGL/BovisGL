package com.bovisgl.hub

import org.bukkit.Bukkit
import org.bukkit.Material
import org.bukkit.entity.Player
import org.bukkit.event.EventHandler
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerCommandPreprocessEvent
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerQuitEvent
import org.bukkit.inventory.Inventory
import org.bukkit.inventory.ItemStack
import org.bukkit.inventory.meta.ItemMeta
import org.bukkit.plugin.java.JavaPlugin

class ChatGuiListener(private val plugin: JavaPlugin) : Listener {
    private val lastChatTime = mutableMapOf<String, Long>()
    private val doubleTapThreshold = 400L // ms

    @EventHandler
    fun onPlayerCommandPreprocess(event: PlayerCommandPreprocessEvent) {
        // Detect chat open: / (slash) or empty (T key)
        if (event.message == "/" || event.message.isBlank()) {
            val player = event.player
            val now = System.currentTimeMillis()
            val last = lastChatTime[player.name] ?: 0L
            if (now - last < doubleTapThreshold) {
                openDirtGui(player)
                event.isCancelled = true
            }
            lastChatTime[player.name] = now
        }
    }

    @EventHandler
    fun onPlayerQuit(event: PlayerQuitEvent) {
        lastChatTime.remove(event.player.name)
    }

    @EventHandler
    fun onPlayerJoin(event: PlayerJoinEvent) {
        lastChatTime[event.player.name] = 0L
    }

    private fun openDirtGui(player: Player) {
        val inv: Inventory = Bukkit.createInventory(null, 9, "§aHi!")
        val dirt = ItemStack(Material.DIRT)
        val meta: ItemMeta = dirt.itemMeta
        meta.setDisplayName("§ehi")
        dirt.itemMeta = meta
        inv.setItem(4, dirt)
        player.openInventory(inv)
    }
}
