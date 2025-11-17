/**
 * Mobile detection and responsive utilities
 * Used across multiple pages
 */

/**
 * Check if device is mobile based on viewport width
 * @param breakpoint - Breakpoint in pixels (default: 768)
 * @returns true if viewport width is less than or equal to breakpoint
 */
export function isMobile(breakpoint: number = 768): boolean {
  return window.innerWidth <= breakpoint;
}

/**
 * Check if device is tablet
 * @returns true if viewport width is between 768 and 1024
 */
export function isTablet(): boolean {
  const width = window.innerWidth;
  return width > 768 && width <= 1024;
}

/**
 * Check if device is desktop
 * @returns true if viewport width is greater than 1024
 */
export function isDesktop(): boolean {
  return window.innerWidth > 1024;
}

/**
 * Get current breakpoint name
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export function getBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width <= 768) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

/**
 * Setup resize listener with debouncing
 * @param callback - Callback function to execute on resize
 * @param delay - Debounce delay in milliseconds (default: 150)
 * @returns Cleanup function
 */
export function onResize(callback: () => void, delay: number = 150): () => void {
  let timeoutId: number;
  
  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(callback, delay);
  };
  
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(timeoutId);
  };
}

/**
 * Check if device is in portrait orientation
 * @returns true if in portrait mode
 */
export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

/**
 * Check if device is in landscape orientation
 * @returns true if in landscape mode
 */
export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}
