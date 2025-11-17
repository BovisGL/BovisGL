package com.bovisgl.proxy

import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.player.PlayerChatEvent
import com.velocitypowered.api.proxy.Player
import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.messages.ChannelIdentifier
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier
import org.slf4j.Logger
import java.util.concurrent.ConcurrentHashMap

class ChatGuiForwarder(private val server: ProxyServer, private val logger: Logger) {
    private val lastChatTime = ConcurrentHashMap<Any, Long>()
    private val doubleTapThreshold = 400L // ms

    @Subscribe
    fun onPlayerChat(event: PlayerChatEvent) {
        val player = event.player
        val now = System.currentTimeMillis()
        val last = lastChatTime[player.uniqueId] ?: 0L
        if (now - last < doubleTapThreshold) {
            // Forward a plugin message to backend to open GUI
            forwardGuiOpen(player)
        }
        lastChatTime[player.uniqueId] = now
    }

    private fun forwardGuiOpen(player: Player) {
        // Send a plugin message to the backend server
        // (Backend plugin must listen for this and open the GUI)
    val channel: ChannelIdentifier = MinecraftChannelIdentifier.create("bovisgl", "chatgui")
        val data = byteArrayOf(1) // simple payload, can be expanded
        player.currentServer.ifPresent { conn ->
            conn.sendPluginMessage(channel, data)
        }
        logger.info("Forwarded chat GUI open to backend for ${player.username}")
    }
}
