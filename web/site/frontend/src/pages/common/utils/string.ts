/**
 * String and text formatting utilities
 * Used across multiple pages
 */

/**
 * Truncate text to a maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to append (default: '...')
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter of a string
 * @param text - Text to capitalize
 * @returns Capitalized text
 */
export function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Convert camelCase or PascalCase to Title Case
 * @param text - Text to convert
 * @returns Title case text
 */
export function toTitleCase(text: string): string {
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse comma-separated or space-separated list
 * @param input - Input string
 * @returns Array of trimmed items
 */
export function parseList(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Generate random identifier
 * @param length - Length of identifier (default: 8)
 * @returns Random alphanumeric string
 */
export function generateId(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Sanitize HTML to prevent XSS
 * @param html - HTML string to sanitize
 * @returns Sanitized string
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
