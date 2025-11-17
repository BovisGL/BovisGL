package com.bovisgl.proxy.commands

import com.velocitypowered.api.command.SimpleCommand
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor

class ServerStatusCommand(private val baseUrl: String, private val target: String) : SimpleCommand {
    private val client = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(2, TimeUnit.SECONDS)
        .build()

    override fun execute(invocation: SimpleCommand.Invocation) {
        val src = invocation.source()
        val url = "$baseUrl/api/servers"
        try {
            val req = Request.Builder().url(url).get().build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    src.sendMessage(Component.text("Status service error: ${resp.code}", NamedTextColor.RED))
                    return
                }
                val body = resp.body?.string() ?: "{}"
                // Very light parse without pulling full JSON libs here: just find server object
                val lower = body.lowercase()
                val nameIdx = lower.indexOf("\"name\":\"$target\"")
                if (nameIdx == -1) {
                    src.sendMessage(Component.text("$target: offline", NamedTextColor.RED))
                    return
                }
                // crude extraction of currentPlayers and maxPlayers
                val cpIdx = lower.indexOf("currentplayers", nameIdx)
                val mpIdx = lower.indexOf("maxplayers", nameIdx)
                var currentPlayers = "?"
                var maxPlayers = "?"
                if (cpIdx != -1) {
                    val slice = lower.substring(cpIdx).split(',', '\n', '}').firstOrNull() ?: ""
                    currentPlayers = slice.replace(Regex("[^0-9]"), "")
                    if (currentPlayers.isEmpty()) currentPlayers = "?"
                }
                if (mpIdx != -1) {
                    val slice = lower.substring(mpIdx).split(',', '\n', '}').firstOrNull() ?: ""
                    maxPlayers = slice.replace(Regex("[^0-9]"), "")
                    if (maxPlayers.isEmpty()) maxPlayers = "?"
                }
                src.sendMessage(Component.text("$target: online $currentPlayers/$maxPlayers", NamedTextColor.GREEN))
            }
        } catch (e: Exception) {
            src.sendMessage(Component.text("$target: offline (${e.message})", NamedTextColor.RED))
        }
    }
}
