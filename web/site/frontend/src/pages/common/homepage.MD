# Home Page Documentation

This document summarizes every visual "box" (section/card) on the Home page (`frontend (old)/src/components/HomePage.tsx`) and details their contents, the JS/TS functions that control them, CSS classes/inline styles used, exact colors found in the source, and recommended background or CSS variable mappings for migration into the `common` styles.

Path referenced: `web/site/frontend (old)/src/components/HomePage.tsx`

---

## Global notes
- Page root class: `app home-modern`
- Global background (App.css): `#1a1a1a` (use `--bg-primary` in `common/styles/variables.css`)
- Key reactive state and functions used by the page:
  - `isAuthenticated` — managed by `checkAuth()` which calls `api.get('/api/locked/auth/verify')` (used to show floating auth button).
  - `checkAuth()` — verifies auth and clears localStorage on transition to unauthenticated.
  - `checkServerStatus()` — polls `api.get('/api/public/servers/status')`, maps to `serversOnline` object ({hub, anarchy, proxy}).
  - `isLaunched` — computed from countdown timer (launch date hard-coded: `2025-07-29T18:00:00.000Z`). Controls whether countdown or live banner shows.
  - `countdown` — days/hours/minutes/seconds; updated every second.

Common animations used (via App.css or inline): `pulse` and `blink`.

Recommended global replacements when migrating:
- Use `--bg-primary` for page background (`#1a1a1a`).
- Map inline accent colors to variables in `common/styles/variables.css` (e.g. `--accent-primary: #00ffff`, `--accent-blue: #4f8cff`, `--status-online: #4CAF50`, `--danger: #f44336`).

---

## Sections / Boxes

Each section listed below contains:
- Title: short name
- Selector: CSS class or element in `HomePage.tsx`
- Purpose / content summary
- Functions/state that control it
- Inline styles or CSS colors used (exact hex or rgba values found in the source)
- Suggested background / mapping to `common` style variables

### 1) Floating Auth Buttons
- Selector: `<div class="floating-auth-btn">` (top of render)
- Purpose: Show `Admin Console` or `Admin Login` depending on `isAuthenticated`.
- Functions / state: `isAuthenticated`, `navigate()` from `react-router-dom`.
- Styling (inline): `flexDirection: 'column', alignItems: 'flex-end', gap: 8` (JS inline)
- Colors: buttons use class `button modern-admin` (global button styles); specific colors come from CSS; no inline color override.
- Background suggestion: none — keep transparent, use `common/styles/buttons.css` for button variants. Use `.floating-auth-btn` -> `position: fixed; top/right` in page-specific CSS.

---

### 2) Copper Age Live Update Banner (Top announcement)
- Selector: top `section` (first `section` inside `main-left-center`)
- Purpose: Announce a server update (copy, highlights, changes); contains CTA "Join Now" link.
- Functions / state: `isMobile` used to adjust padding and font sizes.
- Inline styles (full):
  - background: `linear-gradient(135deg, rgba(255, 87, 34, 0.15), rgba(255, 235, 59, 0.12))`
  - border: `2px solid rgba(255, 193, 7, 0.35)`
  - boxShadow: `0 10px 28px rgba(0,0,0,0.25)`
  - heading color: `#ffd54f` (approx amber)
  - heading textShadow: `rgba(255, 235, 59, 0.35)`
  - paragraph color: `#fff9c4` (pale yellow)

- Colors & exact values found in source:
  - gradient start: rgba(255, 87, 34, 0.15)
  - gradient end: rgba(255, 235, 59, 0.12)
  - border color: rgba(255, 193, 7, 0.35)
  - heading color: `#ffd54f`
  - paragraph color: `#fff9c4`
  - highlight card backgrounds within the banner: `rgba(255, 87, 34, 0.12)` and `rgba(139, 195, 74, 0.12)`; borders `rgba(255,87,34,0.35)` and `rgba(139,195,74,0.35)`; heading accent `#ffab91` and `#c5e1a5` for the highlight cards.

- Suggested mapping to `common/styles`:
  - Create class `.announcement-banner` that uses `--accent-warn` and `--accent-highlight` variables.
  - Background recommendation: `background: linear-gradient(135deg, rgba(var(--accent-warn-rgb), 0.12), rgba(var(--accent-amber-rgb), 0.1))` (store RGB separately as variables for reuse).
  - CTA button: use `.button-success` or a new `.button-cta` using `--status-online` gradient.

---

### 3) "Coming Soon" Hero / Server Overview
- Selector: `<section class="server-overview">` and contained dynamic banners
- Purpose: Shows site title, SEO hidden items, dynamic Anarchy banner (either countdown or live), trailer, summary, features.

Sub-boxes inside this area:

3.1) Page heading (`h1.section-title`)
- Content: "🚀 BovisGL Network - Coming Soon!"
- Styling: `fontSize: '3em'`, `textAlign: 'center'`, `marginBottom: '20px'`.

3.2) Dynamic Anarchy Server Banner (live or countdown)
- Controlled by: `isLaunched` (if true -> live banner, else countdown banner) and `serversOnline.anarchy` (live color/status).

Live banner inline styles (when `isLaunched` true):
- background: `linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(27, 94, 32, 0.2))`
- border: `3px solid rgba(76, 175, 80, 0.5)`
- borderRadius: `20px`
- padding: `30px`
- heading color: `#4CAF50` (green)
- server status dot: `backgroundColor: serversOnline.anarchy ? '#4CAF50' : '#ff9800'` and `animation: blink` when online

Countdown banner inline styles (when `isLaunched` false):
- background: `linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(183, 28, 28, 0.2))`
- border: `3px solid rgba(244, 67, 54, 0.5)`
- heading color: `#f44336` (red)
- countdown boxes: dark background `rgba(0,0,0,0.3)` with border `2px solid rgba(244,67,54,0.3)` and number colors `#f44336`, `#ff5722`, `#ff7043`, `#ff8a65` for days/hours/minutes/seconds respectively.

- Suggested mapping:
  - Replace with `.server-banner-live` and `.server-banner-countdown` classes; use theme variables: `--status-online`, `--error-color`, and border alpha using CSS color `rgba()` with variables.

3.3) Trailer / Video Section
- Container background switches depending on `isLaunched` (`greenish` vs `orange/red` gradients).
- Border and box-shadow colors match the live/countdown state.
- Embedded iframe uses 16:9 container with `boxShadow`.

3.4) Crossplay and Info Panels
- Several panels use gradient backgrounds: examples: green-blue gradient `linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(33, 150, 243, 0.1))` with border `2px solid rgba(76, 175, 80, 0.3)`.
- Colors: `#4CAF50` (green), `#2196F3` (blue), `#9C27B0` (purple) etc.

---

### 4) Why BovisGL? (purple panel)
- Selector: gradient panel with purple accents (inside the server-overview area).
- Purpose: marketing copy; list of bullets why players should join.
- Styling / colors: background gradient between blue-ish and purple-ish: `rgba(33, 150, 243, 0.1)` and `rgba(156, 39, 176, 0.1)`; border `2px solid rgba(156, 39, 176, 0.3)`; title color `#BA68C8` and text shadow `rgba(186, 104, 200, 0.3)`.
- Suggested mapping: `.info-panel.purple` using `--accent-purple` variables.

---

### 5) Launch Timeline (yellow/orange panel)
- Selector: `div` with gradient `rgba(255, 193, 7, 0.1)` and border `rgba(255, 193, 7, 0.3)`.
- Purpose: shows timeline cards (grid of date entries) — children have red or green card styles to indicate different dates.
- Colors in children:
  - red card: `background: rgba(244, 67, 54, 0.2); border: 1px solid rgba(244,67,54,0.3); heading color: #f44336`
  - green card: `background: rgba(76,175,80,0.2); border: 1px solid rgba(76,175,80,0.3); heading color: #4CAF50`

---

### 6) Discord CTA
- Selector: gradient card with `#7289DA` / `#5865F2` gradient background for the CTA button.
- Purpose: Prominent CTA button to join Discord.
- CTA button inline styles: `background: linear-gradient(45deg, #7289DA, #5865F2); color: white; boxShadow: 0 4px 15px rgba(114,137,218,0.3)`.
- Suggested mapping: `.cta-discord` and `.button-primary` using `--accent-blue` variables.

---

### 7) How to Join
- Selector: `#how-to-join` block with green accents
- Purpose: instructions for Java/Bedrock joining, includes two cards (Java / Bedrock) with icons.
- Colors: main green accents `rgba(76, 175, 80, 0.1)` with borders `rgba(76,175,80,0.3)`; Java card uses `#2196F3`, Bedrock uses `#9C27B0`.
- Extra inner warning card uses amber `rgba(255,193,7,0.1)` and `#FFD54F` text.

---

### 8) `main.home-content` — Current Server: Anarchy block
- Selector: `main.home-content` and `.server-cards` / `.server-card` (within bottom of this file)
- Purpose: Key server card presenting the Anarchy server's status and short description.
- Functions / state used: `isLaunched`, `serversOnline.anarchy`, `countdown` indirectly. Also the `ServerCard` component in the codebase is used in other places — but this particular server card is a home-embedded simplified card with classes:
  - `.server-card` (outer card), contains `.server-banner` (top accent) and `.server-content`.
  - `.server-stats` holds `.server-name` and `.server-status` (with classes `status-online`, `status-offline`, `status-coming-soon`).

- Inline/JS-injected CSS for the banner: CSS custom properties set:
  - `--banner-start` and `--banner-end` driven by `isLaunched` and `serversOnline.anarchy`.
  - Example values encountered:
    - `--banner-start`: `#2E7D32` (dark green) or `#b71c1c` (dark red)
    - `--banner-end`: `#4CAF50` (green) or `#f44336` (red)

- Server description box colors:
  - background snippet for live/online: `rgba(76, 175, 80, 0.1)` when online, `rgba(244, 67, 54, 0.1)` when offline or countdown.
  - text colors: `#4CAF50` (green) or `#f44336` (red) used for status text.

- Suggested mapping to `common/styles`:
  - `.server-card` -> `common/styles/cards.css` (already created)
  - Convert `--banner-start`/`--banner-end` to `--server-banner-start` and `--server-banner-end` CSS vars and set them per-server via inline style or via a helper class (e.g. `.server-banner--green`).

---

### 9) Contact Section
- Selector: `.contact-section` with `.contact-grid` and `.contact-item` children
- Purpose: Site contact details (Website, Discord, Email)
- Styling: no heavy inline color usage; uses class-based styles for layout in `App.css` (or migration target). Links are typical anchor tags.

---

### 10) Rules Section
- Selector: `.rules-section`, `.rules-list`, `.rule-item`
- Purpose: Displays server rules with numbered blocks and a yellow highlighted reminder box at the bottom.
- Bottom highlighted box:
  - background: `rgba(255, 193, 7, 0.1)`
  - border: `1px solid rgba(255, 193, 7, 0.3)`
  - title color: `#FFC107`

- Suggest mapping: `.rules-panel` using `--warning` variables.

---

## Functions and Behavior Summary (home page)

- checkAuth() — verifies `/api/locked/auth/verify` and updates `isAuthenticated`; clears localStorage on logout transitions.
- checkServerStatus() — fetches `/api/public/servers/status` and maps to `serversOnline` state; used to show server dots and status texts.
- A repeated `useEffect` runs `checkServerStatus()` immediately and then every 30 seconds.
- Countdown logic: `launchDate = new Date('2025-07-29T18:00:00.000Z')` — updates state every second.
- Responsive boolean `isMobile` toggled by resize listener; used to adjust paddings and grid templates.

### ServerCard (separate component used elsewhere; related notes)
- Path: `web/site/frontend (old)/src/components/ServerCard.tsx`
- Key behaviors:
  - Polls `/api/public/servers/status` every 5 seconds for live server runtime state.
  - Fetches CSRF token from `/api/public/csrf-token` for start/stop actions.
  - Uses `useServerActions` hook (not included here) to call start/stop operations and to track `pendingAction` and `isLoading` states.
  - Opens `ServerDetails` in a portal on click.
- Important styling hooks: top accent `.top-accent` uses `initialServer.color` to style top stripe; `title`, `muted`, `status` classes used for text.

---

## Colors found (explicit values in HomePage.tsx)
A non-exhaustive list of exact hex / rgba values used inline in `HomePage.tsx`:

- Page background: `#1a1a1a`
- Server card background: `#2a2a2a`
- Accent / green: `#4CAF50` (also `#2E7D32`, `#8BC34A`, `#a5d6a7`, `#c8e6c9`)
- Accent / amber/yellow: `#FFD54F`, `#FFC107`, `rgba(255,193,7,0.35)`
- Accent / red/orange: `#f44336`, `#ff5722`, `#ff7043`, `#ff8a65`, `rgba(255,87,34,0.15)`
- Accent / blue: `#2196F3`, `#33b5e5` (seen in various panels; `#7289DA` for Discord CTA)
- Accent / purple: `#9C27B0`, `#BA68C8`, `rgba(156,39,176,0.1)`
- Light text used in banners: `#fff9c4`, `#ffe0b2`, `#ffccbc`, `#fffde7` (subtle light shades)
- Neutral text colours: `#e0e0e0`, `#cfcfcf`, `#bfc7d5`, `#888`
- Panel dark overlays: `rgba(0,0,0,0.3)` and `rgba(0,0,0,0.8)` for video container or status blocks

---

## Migration / Implementation Notes
- Replace inline colors with CSS variables defined in `common/styles/variables.css`.
  - Example mapping:
    - `--bg-primary: #1a1a1a`
    - `--panel-bg: var(--bg-secondary)` -> `#2a2a2a`
    - `--accent-green: #4CAF50`
    - `--accent-danger: #f44336`
    - `--accent-amber: #FFC107`
    - `--accent-blue: #2196F3`
    - `--accent-purple: #9C27B0`
- Convert repeated inline `borderRadius`, `padding`, `boxShadow` usages into classes in `common/styles/cards.css` and `layout.css`.
- For dynamic per-server banner colors, prefer using a CSS custom property like `--server-banner-start` and `--server-banner-end`, set on the server card element inline (still one-liner) and referenced in `.server-banner { background: linear-gradient(90deg, var(--server-banner-start), var(--server-banner-end)); }`.
- Convert the countdown and live banners to use `.banner--live` and `.banner--countdown` classes. Use `animation: var(--pulse)` or `animation: pulse 2s infinite` from `App.css`.
- Centralize `checkServerStatus()` and `checkAuth()` in `common/utils/auth.ts` and `common/utils/serverStatus.ts` (some utilities were already created in `common/utils/` during prior extraction). Use the existing `fetchServerStatus` and `checkAuthentication` helpers.

---

## Suggested quick task list for next step
1. Replace inline banner styles with `.announcement-banner` class and map its colors to variables.
2. Move the dynamic Anarchy banner into a small component (e.g. `AnarchyBanner.tsx`) that accepts `isLaunched`, `serversOnline` and `isMobile` as props.
3. Create CSS variables for all color shades used here (green shades, red shades, amber/yellow shades, blue, purple) in `common/styles/variables.css` (many were already added by the earlier extraction).
4. Convert the single `.server-card` in this page to use the `ServerCard` component or the `common/styles/cards.css` card classes and the `--server-banner-*` CSS vars.

---

## File created
- `frontend/src/pages/common/homepage.MD` (this document).

If you'd like, I can now:
- (A) replace the inline styles with class names and variables directly in `HomePage.tsx`, creating the new CSS classes in `common/styles/` and updating the code; or
- (B) break the dynamic banners into small React components (e.g. `AnarchyBanner`, `TrailerPanel`) and wire them to `common/utils` helpers.

Tell me which next step you want me to take and I'll implement it.
