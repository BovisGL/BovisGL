package com.bovisgl.proxy.bans.util

import java.time.LocalDateTime
import java.util.regex.Pattern

object DurationParser {
    private val DURATION_PATTERN = Pattern.compile("^(\\d+)([smhdwy])$", Pattern.CASE_INSENSITIVE)
    
    fun isDuration(input: String): Boolean {
        return DURATION_PATTERN.matcher(input).matches()
    }
    
    fun parseDuration(input: String): LocalDateTime? {
        val matcher = DURATION_PATTERN.matcher(input)
        if (!matcher.matches()) return null
        
        val amount = matcher.group(1).toLongOrNull() ?: return null
        val unit = matcher.group(2).lowercase()
        
        val now = LocalDateTime.now()
        
        return when (unit) {
            "s" -> now.plusSeconds(amount)
            "m" -> now.plusMinutes(amount)
            "h" -> now.plusHours(amount)
            "d" -> now.plusDays(amount)
            "w" -> now.plusWeeks(amount)
            "y" -> now.plusYears(amount)
            else -> null
        }
    }
    
    fun formatDuration(duration: String): String {
        val matcher = DURATION_PATTERN.matcher(duration)
        if (!matcher.matches()) return duration
        
        val amount = matcher.group(1)
        val unit = when (matcher.group(2).lowercase()) {
            "s" -> if (amount == "1") "second" else "seconds"
            "m" -> if (amount == "1") "minute" else "minutes"
            "h" -> if (amount == "1") "hour" else "hours"
            "d" -> if (amount == "1") "day" else "days"
            "w" -> if (amount == "1") "week" else "weeks"
            "y" -> if (amount == "1") "year" else "years"
            else -> matcher.group(2)
        }
        
        return "$amount $unit"
    }
}
