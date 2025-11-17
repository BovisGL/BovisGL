package com.bovisgl.proxy.tracking

import com.bovisgl.proxy.client.ClientDetectListener
import com.google.gson.Gson
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.connection.DisconnectEvent
import com.velocitypowered.api.event.connection.PostLoginEvent
import com.velocitypowered.api.event.player.ServerConnectedEvent
import com.velocitypowered.api.proxy.ProxyServer
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.logging.Level
import java.util.logging.Logger

/**
 * Simplified player tracker that forwards join/switch/leave events
 * to the communications service for persistence.
 */
class PlayerTracker(
    private val server: ProxyServer,
    private val logger: Logger,
    private val clientDetect: ClientDetectListener
) {

    private val http = OkHttpClient()
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val joinedPlayers = Collections.newSetFromMap(ConcurrentHashMap<UUID, Boolean>())
    private val pendingClientTokens = ConcurrentHashMap<UUID, String>()
    private val lastPostedClientTokens = ConcurrentHashMap<UUID, String>()
    private val communicationsBase: String = run {
        System.getProperty("bovisgl.communications.base")
            ?: System.getenv("BOVISGL_COMMS")
            ?: System.getenv("COMMS_BASE")
            ?: "http://127.0.0.1:3456"
    }

    private val sessions: MutableMap<UUID, String?> = ConcurrentHashMap()

    fun initialize() {
        clientDetect.registerTracker(this)
        logger.info("Player tracker ready (communications sync)")
    }

    // Compare two semantic version strings (e.g. "1.21.8" < "1.21.9").
    // Returns true if a < b.
    private fun isVersionLessThan(a: String?, b: String): Boolean {
        if (a == null) return true
        fun toInts(v: String): List<Int> = v.split('.').mapNotNull { part -> part.filter { it.isDigit() }.takeIf { it.isNotEmpty() }?.toIntOrNull() }
        val av = toInts(a)
        val bv = toInts(b)
        val n = maxOf(av.size, bv.size)
        for (i in 0 until n) {
            val ai = if (i < av.size) av[i] else 0
            val bi = if (i < bv.size) bv[i] else 0
            if (ai < bi) return true
            if (ai > bi) return false
        }
        return false
    }

    fun shutdown() {
        joinedPlayers.clear()
        pendingClientTokens.clear()
        lastPostedClientTokens.clear()
        sessions.clear()
        logger.info("Player tracker shutdown complete")
    }

    @Subscribe
    fun onPostLogin(event: PostLoginEvent) {
        val player = event.player
        val name = player.username
        val uuid = player.uniqueId
        val serverName = player.currentServer.orElse(null)?.serverInfo?.name
        if (serverName != null) {
            sessions[uuid] = serverName
        } else {
            sessions.remove(uuid)
        }
        joinedPlayers.add(uuid)
        val clientToken = clientDetect.currentClientToken(uuid)
        if (clientToken != null) {
            lastPostedClientTokens[uuid] = clientToken
        }
        notifyCommunicationsJoin(uuid, name, serverName, clientToken)

        val pending = pendingClientTokens.remove(uuid)
        if (pending != null && pending != clientToken) {
            lastPostedClientTokens[uuid] = pending
            notifyCommunicationsSwitch(uuid, name, serverName, pending)
        }
    }

    @Subscribe
    fun onServerConnected(event: ServerConnectedEvent) {
        val player = event.player
        val uuid = player.uniqueId
        val currentServer = event.server.serverInfo.name
        sessions[uuid] = currentServer

        if (!joinedPlayers.contains(uuid)) {
            joinedPlayers.add(uuid)
            val token = clientDetect.currentClientToken(uuid)
            if (token != null) {
                lastPostedClientTokens[uuid] = token
            }
            notifyCommunicationsJoin(uuid, player.username, currentServer, token)
            return
        }

        // If player connected to the hub, and we have a client token indicating
        // a Java client older than 1.21.9, send an in-game informational warning
        // recommending an upgrade before reporting bugs.
        try {
            val tokenToCheck = clientDetect.currentClientToken(uuid) ?: lastPostedClientTokens[uuid]
            if (!tokenToCheck.isNullOrBlank() && currentServer.equals("hub", ignoreCase = true)) {
                if (tokenToCheck.startsWith("java.")) {
                    val verRange = tokenToCheck.removePrefix("java.")
                    val maxVer = verRange.split('-').last().trim()
                    if (isVersionLessThan(maxVer, "1.21.9")) {
                        val welcome = LegacyComponentSerializer.legacyAmpersand().deserialize("&6Welcome to BovisGL, &e${'$'}{player.username}&6! &7You can explore the hub or go through the lava portal to head to Anarchy.")
                        val advise1 = LegacyComponentSerializer.legacyAmpersand().deserialize("&cNote: Your Java client (&e${'$'}maxVer&c) is older than &e1.21.9&c and may be buggy. Please try upgrading to &e1.21.9+&c before reporting bugs.")
                        val advise2 = LegacyComponentSerializer.legacyAmpersand().deserialize("&7Use &e/discord &7for an invite and visit &ehttps://bovisgl.xyz &7for updates.")
                        player.sendMessage(welcome)
                        player.sendMessage(advise1)
                        player.sendMessage(advise2)
                    }
                }
            }
        } catch (t: Throwable) {
            logger.log(Level.FINE, "[tracker] client-version warning check failed: ${t.message}")
        }

        val token = clientDetect.currentClientToken(uuid) ?: lastPostedClientTokens[uuid]
        if (token != null) {
            lastPostedClientTokens[uuid] = token
        }
        notifyCommunicationsSwitch(uuid, player.username, currentServer, token)
    }

    @Subscribe
    fun onDisconnect(event: DisconnectEvent) {
        val player = event.player
        val uuid = player.uniqueId
        sessions.remove(uuid)

        val clientToken = clientDetect.currentClientToken(uuid) ?: lastPostedClientTokens[uuid]
        notifyCommunicationsLeave(uuid, player.username, clientToken)

        joinedPlayers.remove(uuid)
        lastPostedClientTokens.remove(uuid)
        pendingClientTokens.remove(uuid)
    }

    fun notifyClientToken(uuid: UUID) {
        val token = clientDetect.currentClientToken(uuid) ?: return
        if (!joinedPlayers.contains(uuid)) {
            pendingClientTokens[uuid] = token
            return
        }

        val optionalPlayer = server.getPlayer(uuid)
        val player = optionalPlayer.orElse(null) ?: run {
            pendingClientTokens[uuid] = token
            return
        }

        val previous = lastPostedClientTokens[uuid]
        if (previous == token) return

        val serverName = sessions[uuid]
            ?: player.currentServer.orElse(null)?.serverInfo?.name

        lastPostedClientTokens[uuid] = token
        notifyCommunicationsSwitch(uuid, player.username, serverName, token)
    }

    private fun notifyCommunicationsJoin(uuid: UUID, name: String, serverName: String?, clientToken: String?) {
        val payload = mutableMapOf<String, Any>(
            "uuid" to uuid.toString(),
            "name" to name
        )
        serverName?.let { payload["server"] = it }
        clientToken?.let { 
            payload["client"] = it
            // Extract account type from client token (bedrock.x.x.x or java.x.x.x)
            if (it.startsWith("bedrock")) {
                payload["accountType"] = "bedrock"
            } else if (it.startsWith("java")) {
                payload["accountType"] = "java"
            }
        }
        postJson("/api/players/join", payload, "join")
    }

    private fun notifyCommunicationsSwitch(uuid: UUID, name: String, serverName: String?, clientToken: String?) {
        if (serverName == null && clientToken == null) return
        val payload = mutableMapOf<String, Any>(
            "uuid" to uuid.toString(),
            "name" to name
        )
        serverName?.let {
            payload["server"] = it
            payload["currentServer"] = it
        }
        clientToken?.let { payload["client"] = it }
        postJson("/api/players/switch", payload, "switch")
    }

    private fun notifyCommunicationsLeave(uuid: UUID, name: String, clientToken: String?) {
        val payload = mutableMapOf<String, Any>(
            "uuid" to uuid.toString(),
            "name" to name
        )
        clientToken?.let { payload["client"] = it }
        postJson("/api/players/leave", payload, "leave")
    }

    private fun postJson(path: String, payload: Map<String, Any>, context: String) {
        val base = communicationsBase.trimEnd('/')
        val url = if (path.startsWith("/")) base + path else "$base/$path"
        val json = gson.toJson(payload)
        val request = Request.Builder()
            .url(url)
            .post(json.toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                logger.warning("[tracker] $context request failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) {
                        logger.warning("[tracker] $context request to $url returned HTTP ${it.code}")
                    } else if (logger.isLoggable(Level.FINE)) {
                        logger.fine("[tracker] $context request to $url ok")
                    }
                }
            }
        })
    }
}
