package anarchy.bovisgl

import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents
import net.minecraft.item.ItemStack
import net.minecraft.item.Items
import net.minecraft.screen.GenericContainerScreenHandler
import net.minecraft.screen.SimpleNamedScreenHandlerFactory
import net.minecraft.server.network.ServerPlayerEntity
import net.minecraft.text.Text

object ChatGuiHandler {
    fun register() {
        // Minimal stub for chat GUI handler registration
        // Real implementation can register ServerPlayConnectionEvents.CHAT
        // and open a custom screen. This avoids referencing unstable internals.
    }
}
