package com.bovisgl.proxy.commands

import com.velocitypowered.api.command.SimpleCommand
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.event.ClickEvent
import net.kyori.adventure.text.event.HoverEvent
import org.slf4j.Logger
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

class SignInCommand(private val logger: Logger): SimpleCommand {

    override fun execute(invocation: SimpleCommand.Invocation) {
        val source = invocation.source()
        if (source !is com.velocitypowered.api.proxy.Player) {
            source.sendMessage(Component.text("This command is only for players."))
            return
        }

        val username = source.username
        // Call backend to create a code
        val apiUrl = System.getenv("BOVISGL_API") ?: "https://backend.bovisgl.xyz" // base URL
        val endpoint = "$apiUrl/api/public/mc-link/code"
        try {
            val conn = URL(endpoint).openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            val body = "{\"username\":\"$username\",\"serverId\":\"proxy\"}"
            conn.outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
            val code: String? = if (conn.responseCode in 200..299) {
                val text = conn.inputStream.bufferedReader().readText()
                // naive parse for 'code'
                val match = Regex("\\\"code\\\"\\s*:\\s*\\\"([A-Z0-9]+)\\\"").find(text)
                match?.groupValues?.get(1)
            } else null

            if (code == null) {
                source.sendMessage(Component.text("§cFailed to generate sign-in code. Try again later."))
                return
            }

            val linkUrl = "https://bovisgl.xyz/connect"
            source.sendMessage(Component.text("§a==== Account Link ===="))
            source.sendMessage(Component.text("§7Use this code on the website within 5 minutes:"))
            source.sendMessage(Component.text("§b§l$code"))
            val clickable = Component.text("§eClick here or visit §f$linkUrl")
                .hoverEvent(HoverEvent.showText(Component.text("Open link")))
                .clickEvent(ClickEvent.openUrl(linkUrl))
            source.sendMessage(clickable)
            source.sendMessage(Component.text("§7Then enter the code to link your Minecraft account."))

        } catch (e: Exception) {
            logger.error("Failed to create MC link code", e)
            source.sendMessage(Component.text("§cError generating sign-in code."))
        }
    }
}
