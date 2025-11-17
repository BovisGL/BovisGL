package com.bovisgl.proxy.client

import com.bovisgl.proxy.tracking.PlayerTracker
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.connection.LoginEvent
import com.velocitypowered.api.event.connection.PluginMessageEvent
import com.velocitypowered.api.proxy.Player
import com.velocitypowered.api.proxy.ProxyServer
import org.slf4j.Logger
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.Collections

/**
 * Detects client info (brand/loader, protocol, bedrock) and posts a de-duplicated
 * list of client identifiers to the communications service on join and when brand is discovered.
 */
class ClientDetectListener(
    private val server: ProxyServer,
    private val logger: Logger
) {
    companion object {
        private val VERSION_PATTERN = Regex("[0-9]+(?:\\.[0-9]+)*")
    }

    data class ClientInfo(
        var isBedrock: Boolean = false,
        var javaProtocolVersion: Int? = null,
        var javaVersionName: String? = null,
        var bedrockVersion: String? = null,
        var clientBrand: String? = null,
        var uuid: UUID? = null,
        var username: String? = null
    )

    private val infoByUuid: MutableMap<UUID, ClientInfo> = ConcurrentHashMap()
    private var tracker: PlayerTracker? = null
    private val missingClientLogged = Collections.newSetFromMap(ConcurrentHashMap<UUID, Boolean>())

    fun registerTracker(tracker: PlayerTracker) {
        this.tracker = tracker
    }

    fun currentClientToken(uuid: UUID): String? {
        val info = infoByUuid[uuid] ?: return null
        val token = deriveClientToken(info)
        if (token != null) {
            info.uuid?.let { missingClientLogged.remove(it) }
        }
        return token
    }

    private fun sanitizeVersion(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val trimmed = raw.trim()
        val matches = VERSION_PATTERN.findAll(trimmed).toList()
        if (matches.isEmpty()) return null
        // If range like "1.21.9 - 1.21.10", pick the LAST (highest) version
        // because clients connecting are typically running the latest patch
        return matches.lastOrNull()?.value
    }

    private fun deriveClientToken(ci: ClientInfo): String? {
        if (ci.isBedrock) {
            val version = sanitizeVersion(ci.bedrockVersion)
            if (version != null) return "bedrock.$version"
            noteMissingClient(ci, "bedrock version unavailable")
            return null
        }

        // For Java: try ViaVersion's version name first (may include range like "1.21.9 - 1.21.10")
        val fromName = sanitizeVersion(ci.javaVersionName)
        if (fromName != null) return "java.$fromName"

        // Fallback to protocol mapping if ViaVersion not available
        val fromProtocol = ci.javaProtocolVersion
            ?.let { mapProtocolToVersion(it) }

        if (fromProtocol != null) return "java.$fromProtocol"

        noteMissingClient(ci, "java version unavailable")
        return null
    }

    /**
     * Best-effort mapping from Java protocol number to version string(s).
     * When a protocol covers multiple patch versions, we store all of them.
     * ViaVersion's getName() should give us the accurate range when available.
     */
    private fun mapProtocolToVersion(pv: Int): String? {
        // Return the full range or best estimate for this protocol
        return when (pv) {
            773 -> "1.21.9-1.21.10"  // Covers both 1.21.9 and 1.21.10
            772 -> "1.21.7-1.21.8"   // Covers both 1.21.7 and 1.21.8
            771 -> "1.21.6"
            770 -> "1.21.5"
            769 -> "1.21.3-1.21.4"   // Covers both 1.21.3 and 1.21.4
            768 -> "1.21.2"
            767 -> "1.21-1.21.1"     // Covers both 1.21 and 1.21.1
            766 -> "1.20.5-1.20.6"   // Covers both 1.20.5 and 1.20.6
            765 -> "1.20.3-1.20.4"   // Covers both 1.20.3 and 1.20.4
            764 -> "1.20.2"
            763 -> "1.20.1"
            762 -> "1.20"
            761 -> "1.19.4"
            760 -> "1.19.3"
            else -> null
        }
    }

    @Subscribe
    fun onLogin(event: LoginEvent) {
        val player = event.player
        val uuid = player.uniqueId
        val ci = infoByUuid.getOrPut(uuid) { ClientInfo() }
        ci.uuid = uuid
        ci.username = player.username

        // Java protocol (for Java clients)
        try {
            // Prefer Velocity API where available
            val pvObj = try { player.protocolVersion } catch (_: Throwable) { null }
            var proto: Int? = null
            if (pvObj != null) {
                proto = try { pvObj.javaClass.getMethod("getProtocol").invoke(pvObj) as? Int } catch (_: Throwable) { null }
                // Also try to read a human-readable name if available (Velocity 3.x provides it)
                ci.javaVersionName = runCatching { pvObj.javaClass.getMethod("getName").invoke(pvObj) as? String }.getOrNull()
            }
            if (proto == null) {
                val m = player.javaClass.methods.firstOrNull { it.name == "getProtocolVersion" && it.parameterCount == 0 }
                val v = m?.invoke(player)
                proto = when (v) {
                    is Int -> v
                    null -> null
                    else -> try { v.javaClass.getMethod("getProtocol").invoke(v) as? Int } catch (_: Throwable) { null }
                }
            }
            ci.javaProtocolVersion = proto

            // Try ViaVersion (if installed) to resolve a friendly version name
            if (ci.javaVersionName.isNullOrBlank() && proto != null) {
                try {
                    val pvc = Class.forName("com.viaversion.viaversion.api.protocol.version.ProtocolVersion")
                    val getProtocol = pvc.getMethod("getProtocol", Int::class.javaPrimitiveType)
                    val pvEnum = getProtocol.invoke(null, proto)
                    if (pvEnum != null) {
                        val name = runCatching { pvEnum.javaClass.getMethod("getName").invoke(pvEnum) as? String }.getOrNull()
                        if (!name.isNullOrBlank()) {
                            ci.javaVersionName = name
                            logger.debug("[client-detect] ViaVersion name for proto $proto: $name")
                        }
                    }
                } catch (_: Throwable) {
                    // ignore if ViaVersion API not present
                }
            }

            if (!ci.javaVersionName.isNullOrBlank()) {
                val sanitized = sanitizeVersion(ci.javaVersionName)
                if (!sanitized.isNullOrBlank()) ci.javaVersionName = sanitized
            }
        } catch (t: Throwable) {
            logger.debug("[client-detect] protocol version read failed: ${'$'}{t.message}")
        }

        // Try Geyser API via reflection if present
        try {
            // Prefer Floodgate API for richer data when present
            val fClazz = Class.forName("org.geysermc.floodgate.api.FloodgateApi")
            val fApi = fClazz.getMethod("getInstance").invoke(null)
            val isFg = runCatching { fApi.javaClass.getMethod("isFloodgatePlayer", UUID::class.java).invoke(fApi, uuid) as? Boolean }.getOrNull() ?: false
            if (isFg) {
                ci.isBedrock = true
                val fPlayer = runCatching { fApi.javaClass.getMethod("getPlayer", UUID::class.java).invoke(fApi, uuid) }.getOrNull()
                val version = fPlayer?.let { p ->
                    runCatching { p.javaClass.getMethod("getVersion").invoke(p) as? String }.getOrNull()
                }
                if (!version.isNullOrBlank()) ci.bedrockVersion = version
            } else {
                // Fallback: Geyser API basic check
                val gClazz = Class.forName("org.geysermc.geyser.api.GeyserApi")
                val gApi = gClazz.getMethod("api").invoke(null)
                val method = gApi.javaClass.methods.firstOrNull { it.name == "isBedrockPlayer" && it.parameterCount == 1 }
                if (method != null) {
                    val isBed = (method.invoke(gApi, uuid) as? Boolean) ?: false
                    ci.isBedrock = isBed
                }
            }
        } catch (_: ClassNotFoundException) {
            // Fallback: heuristic by username prefix commonly used by Floodgate
            val name = player.username
            if (name.startsWith(".") || name.startsWith("*") || name.startsWith("~")) ci.isBedrock = true
        } catch (t: Throwable) {
            logger.debug("[client-detect] Geyser check failed: ${'$'}{t.message}")
        }

        // Log detection snapshot
        logger.info("[client-detect] login: name=${ci.username} bedrock=${ci.isBedrock} bedrockVer=${ci.bedrockVersion ?: "-"} proto=${ci.javaProtocolVersion ?: "-"} javaName=${ci.javaVersionName ?: "-"} brand=${ci.clientBrand ?: "-"}")

        tracker?.notifyClientToken(uuid)
    }

    @Subscribe
    fun onPluginMessage(event: PluginMessageEvent) {
        val channel = try {
            // In Velocity 3.x, Identifier has id property (Kotlin accessor)
            event.identifier.id
        } catch (_: Exception) {
            event.identifier.toString()
        }
        if (channel != "minecraft:brand" && channel != "MC|Brand") return
        val src = event.source
        val player = (src as? Player) ?: return
        val uuid = player.uniqueId
        val ci = infoByUuid.getOrPut(uuid) { ClientInfo(uuid = uuid, username = player.username) }
        try {
            val brand = decodeBrand(event.data)
            if (!brand.isNullOrBlank()) ci.clientBrand = brand
        } catch (t: Throwable) {
            logger.debug("[client-detect] failed reading brand: ${'$'}{t.message}")
        }
        ci.uuid = uuid
        ci.username = player.username
        logger.info("[client-detect] brand for ${ci.username}: ${ci.clientBrand}")
        tracker?.notifyClientToken(uuid)
    }

    private fun noteMissingClient(ci: ClientInfo, reason: String) {
        val uuid = ci.uuid ?: return
        if (missingClientLogged.add(uuid)) {
            val name = ci.username ?: uuid.toString()
            logger.info("[client-detect] no reliable client info for $name ($reason); leaving client unset")
        }
    }

    private fun decodeBrand(bytes: ByteArray): String? {
        // Attempt VarInt-length-prefixed UTF-8 string; fallback to whole array as UTF-8
        return try {
            val buf = ByteBuffer.wrap(bytes)
            val len = readVarInt(buf)
            if (len > 0 && len <= buf.remaining()) {
                val arr = ByteArray(len)
                buf.get(arr)
                String(arr, StandardCharsets.UTF_8)
            } else String(bytes, StandardCharsets.UTF_8)
        } catch (_: Exception) {
            try { String(bytes, StandardCharsets.UTF_8) } catch (_: Exception) { null }
        }
    }

    private fun readVarInt(buf: ByteBuffer): Int {
        var numRead = 0
        var result = 0
        var read: Int
        do {
            if (!buf.hasRemaining()) return result
            read = (buf.get().toInt() and 0xFF)
            val value = (read and 0b01111111)
            result = result or (value shl (7 * numRead))
            numRead++
            if (numRead > 5) return result
        } while ((read and 0b10000000) != 0)
        return result
    }
}
