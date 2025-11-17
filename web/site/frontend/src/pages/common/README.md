# Common Shared Resources

This folder contains shared styles, utilities, and components used across multiple pages in the frontend application.

## Structure

```
common/
├── styles/          # Shared CSS styles
├── utils/           # Shared TypeScript utilities
└── components/      # Shared React components (if needed)
```

## Styles (`/styles`)

All shared CSS organized by purpose:

### `variables.css`
- CSS custom properties (colors, spacing, breakpoints)
- Responsive design tokens
- Theme variables

### `buttons.css`
- Button component styles
- Button variants (primary, secondary, success, danger, etc.)
- Hover and active states

### `cards.css`
- Card component styles
- Server cards, panels, sections
- Identity sections and containers

### `layout.css`
- Flexbox and Grid layouts
- Container styles
- Responsive grid systems
- Server grid and admin grid layouts

### `status.css`
- Status indicators (online, offline, starting, etc.)
- Status text classes
- Animations (pulse, blink)

### `forms.css`
- Input field styles
- Textarea and command inputs
- Form groups and labels
- Focus states

### `utilities.css`
- Utility classes for common tasks
- Text alignment, spacing, display
- Error messages and loading states
- Logs and code display

### `index.css`
- Imports all style modules
- Use this to import all common styles at once

## Usage Example (Styles)

```tsx
// Import all common styles
import '@/pages/common/styles/index.css';

// Or import specific modules
import '@/pages/common/styles/buttons.css';
import '@/pages/common/styles/cards.css';
```

## Utilities (`/utils`)

Shared TypeScript functions organized by domain:

### `dateTime.ts`
- `formatDateTime(ts)` - Format timestamp to localized date-time
- `describeDateTimeWithClient(ts, client)` - Format with optional client info
- `formatDate(ts)` - Format date without time
- `formatTime(ts)` - Format time only
- `getRelativeTime(ts)` - Get relative time description (e.g., "2 hours ago")

### `player.ts`
- `getPlayerAvatarUrl(uuid, name, size)` - Generate player avatar URL
- `describeLastSeen(player)` - Describe when player was last seen
- `getPlayerStatusColor(online)` - Get color based on online status
- `sanitizePlayerName(name)` - Sanitize player name for display
- `PlayerSummary` interface

### `auth.ts`
- `checkAuthentication(apiService)` - Check if user is authenticated
- `clearAuthData()` - Clear all auth data from localStorage
- `getAuthToken()` - Get stored auth token
- `isTokenExpired()` - Check if token is expired
- `getUserInfo()` - Get user info from localStorage
- `setUserInfo(userInfo)` - Store user info
- `handleAuthStateChange(was, is)` - Handle auth state transitions

### `serverStatus.ts`
- `fetchServerStatus(apiService)` - Fetch server status from API
- `getServerStatusText(online)` - Get status text
- `getServerStatusClass(online)` - Get CSS class for status
- `ServerStatus` interface

### `string.ts`
- `truncateText(text, maxLength, suffix)` - Truncate text with suffix
- `capitalizeFirst(text)` - Capitalize first letter
- `toTitleCase(text)` - Convert to Title Case
- `formatBytes(bytes, decimals)` - Format bytes to human readable
- `parseList(input)` - Parse comma/space-separated list
- `generateId(length)` - Generate random identifier
- `sanitizeHtml(html)` - Sanitize HTML to prevent XSS

### `responsive.ts`
- `isMobile(breakpoint)` - Check if device is mobile
- `isTablet()` - Check if device is tablet
- `isDesktop()` - Check if device is desktop
- `getBreakpoint()` - Get current breakpoint name
- `onResize(callback, delay)` - Setup resize listener with debouncing
- `isPortrait()` - Check if in portrait orientation
- `isLandscape()` - Check if in landscape orientation

### `index.ts`
- Re-exports all utilities for convenient importing

## Usage Example (Utilities)

```tsx
// Import specific utilities
import { formatDateTime, getRelativeTime } from '@/pages/common/utils/dateTime';
import { isMobile, onResize } from '@/pages/common/utils/responsive';

// Or import from index
import { formatDateTime, isMobile } from '@/pages/common/utils';

// Use in component
const formattedDate = formatDateTime(timestamp);
const mobile = isMobile();
```

## Components (`/components`)

Reserved for shared React components that are used across multiple pages. Currently empty - add shared components as needed.

## Benefits

1. **DRY Principle** - Don't repeat yourself. Write once, use everywhere.
2. **Consistency** - Same styles and behavior across all pages.
3. **Maintainability** - Update in one place, affects all pages.
4. **Type Safety** - TypeScript utilities provide type checking.
5. **Performance** - Shared code can be cached and reused.
6. **Scalability** - Easy to add new shared resources.

## Guidelines

- Keep utilities pure and side-effect free when possible
- Document all functions with JSDoc comments
- Use TypeScript for type safety
- Follow naming conventions (camelCase for functions, PascalCase for components)
- Add tests for complex utilities
- Keep styles modular and scoped to their purpose
