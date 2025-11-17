package anarchy.bovisgl

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback

/**
 * Block vanilla ban commands by preventing their registration.
 * This works by catching and ignoring the registration attempts.
 */
fun registerVanillaBanBlockers() {
    CommandRegistrationCallback.EVENT.register(CommandRegistrationCallback { dispatcher, _, _ ->
        // Get the children map and remove ban-related commands
        try {
            val childrenField = dispatcher.root::class.java.getDeclaredField("children")
            childrenField.isAccessible = true
            @Suppress("UNCHECKED_CAST")
            val children = childrenField.get(dispatcher.root) as? MutableMap<String, Any>
            
            if (children != null) {
                children.remove("ban")
                children.remove("unban")
                children.remove("banlist")
                children.remove("pardon")
                children.remove("pardon-ip")
                children.remove("ban-ip")
            }
        } catch (e: Exception) {
            // Silently fail - commands may not exist or reflection may not work
            println("[VanillaBanBlocker] Note: Could not remove ban commands via reflection: ${e.message}")
        }
    })
}
