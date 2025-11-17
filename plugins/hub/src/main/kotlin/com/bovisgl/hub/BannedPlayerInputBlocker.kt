package com.bovisgl.hub

import org.bukkit.event.EventHandler
import org.bukkit.event.Listener
import org.bukkit.event.player.PlayerMoveEvent
import org.bukkit.event.player.PlayerCommandPreprocessEvent
import org.bukkit.event.player.AsyncPlayerChatEvent
import org.bukkit.event.inventory.InventoryOpenEvent
import org.bukkit.event.block.BlockBreakEvent
import org.bukkit.event.block.BlockPlaceEvent
import org.bukkit.event.player.PlayerInteractEvent
import org.bukkit.event.entity.EntityDamageByEntityEvent
import org.bukkit.event.player.PlayerDropItemEvent
import org.bukkit.plugin.java.JavaPlugin

/**
 * BannedPlayerInputBlocker - Prevents banned players from interacting with the server
 * Blocks:
 * - Movement
 * - Chat
 * - Commands
 * - Inventory opening
 * - Block breaking/placing
 * - Interactions
 * - Combat
 * - Item dropping
 */
class BannedPlayerInputBlocker(private val plugin: JavaPlugin, private val bannedPlayerHandler: BannedPlayerHandler) : Listener {

    @EventHandler
    fun onPlayerMove(event: PlayerMoveEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            // Cancel the movement
            event.isCancelled = true
        }
    }

    @EventHandler
    fun onPlayerChat(event: AsyncPlayerChatEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
            player.sendMessage("§cYou cannot chat while banned.")
        }
    }

    @EventHandler
    fun onPlayerCommand(event: PlayerCommandPreprocessEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
            player.sendMessage("§cYou cannot use commands while banned.")
        }
    }

    @EventHandler
    fun onInventoryOpen(event: InventoryOpenEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
        }
    }

    @EventHandler
    fun onBlockBreak(event: BlockBreakEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
        }
    }

    @EventHandler
    fun onBlockPlace(event: BlockPlaceEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
        }
    }

    @EventHandler
    fun onPlayerInteract(event: PlayerInteractEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
        }
    }

    @EventHandler
    fun onEntityDamage(event: EntityDamageByEntityEvent) {
        val damager = event.damager
        if (damager is org.bukkit.entity.Player && bannedPlayerHandler.isBannedPlayerActive(damager.uniqueId.toString())) {
            event.isCancelled = true
        }
    }

    @EventHandler
    fun onPlayerDropItem(event: PlayerDropItemEvent) {
        val player = event.player
        if (bannedPlayerHandler.isBannedPlayerActive(player.uniqueId.toString())) {
            event.isCancelled = true
        }
    }
}
