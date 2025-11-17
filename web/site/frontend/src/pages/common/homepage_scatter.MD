# Homepage Scan — Scattered Sources in frontend (old)

I scanned the entire `frontend (old)` source for homepage-related strings and UI fragments (keywords: `Anarchy`, `play.bovisgl`, `how-to-join`, `Copper Age`, `countdown`, `isLaunched`, `checkServerStatus`, `serversOnline`, `server-card`, `server-banner`, etc.). This document lists every file where homepage code or homepage styles were found, a short explanation of why it's relevant, key inline colors/snippets to extract, and suggested next steps for centralization.

Scan summary
------------
- Total match count (keywords used): ~140 matches across many files.
- Primary homepage implementation: `components/HomePage.tsx` (main source of page content and inline styles).
- Supporting/home-like content also found in `App.tsx`, `App.css`, `components/ServerCard.tsx`, `components/ServerDetails.tsx`, and several utility/style files.

Important files (ordered by relevance)
--------------------------------------

1) `web/site/frontend (old)/src/components/HomePage.tsx`
   - Relevance: This is the canonical home page file with the bulk of hero banners, countdown, dynamic Anarchy banner, trailer embed, how-to-join, contact, and rules sections.
   - Key state & functions: `isLaunched`, `countdown`, `serversOnline`, `checkServerStatus()`, `checkAuth()`, `isMobile`.
   - Inline style colors to extract:
     - Green: `#4CAF50`, `#2E7D32`, `#8BC34A`, `#a5d6a7`, `#c8e6c9`
     - Red/Orange: `#f44336`, `#ff5722`, `#ff7043`, `#ff8a65`, `rgba(255,87,34,0.15)`
     - Amber: `#FFD54F`, `#FFC107`, `rgba(255,193,7,0.35)`
     - Purple/Blue: `#9C27B0`, `#BA68C8`, `#2196F3`, `#7289DA`
     - Neutral / overlay: `rgba(0,0,0,0.3)`, `#e0e0e0`, `#fff9c4`
   - Notable classes and inline-used selectors: `.server-overview`, `.server-cards`, `.server-card`, `.server-banner`, `.server-content`, `.server-status`, `#how-to-join`, `.home-content`, `.server-cards`, `.contact-section`, `.rules-section`.
   - Action: This file should be the primary target for converting inline styles to `common` classes or extracting the logical sections into components (`AnarchyBanner`, `TrailerPanel`, `HowToJoinCard`, `ContactCard`, `RulesPanel`).

2) `web/site/frontend (old)/src/App.tsx`
   - Relevance: Contains server list definitions (including `anarchy`) and additional `play.bovisgl.xyz` references and route wiring. Also uses `ServerCard` components inside admin/test panels.
   - Key snippets:
     - Server definitions include `{ id: 'anarchy', name: 'Anarchy Server', color: '#8B0000', status: 'offline' }`.
     - Connect details at `/admin/test` panel: `play.bovisgl.xyz:31500` (Java) and `play.bovisgl.xyz` with port `19152` (Bedrock) in other sections.
   - Why it matters: `App.tsx` contains duplicated server connection details and server metadata that the home page references. Consolidate server metadata into a single source (e.g., `common/data/servers.ts` or API-driven metadata).

3) `web/site/frontend (old)/src/App.css`
   - Relevance: Central stylesheet for the old frontend. Contains `.server-card`, `.server-cards`, `.server-banner`, `.countdown-timer`, and many other rules the Home page expects.
   - Key selectors to migrate into `common/styles`:
     - `.server-card`, `.server-banner`, `.server-content`, `.server-title`, `.server-cards` — these are used in HomePage and server components.
     - `.countdown-timer` and `.countdown-timer.expired` — used by countdown UI.
   - Action: Move these rules (or their normalized versions) into `frontend/src/pages/common/styles` (`cards.css`, `layout.css`, `utilities.css`) and replace duplicated inline styles with class usage relying on CSS variables.

4) `web/site/frontend (old)/src/components/ServerCard.tsx`
   - Relevance: Reusable card used in Admin and other panels; has logic for polling `/api/public/servers/status`, start/stop hooks, and a `top-accent` element driven by `initialServer.color`.
   - Key behavior to reuse: `top-accent` stripe which uses `initialServer.color` — convert this to `--server-banner-start` CSS var usage so both home embedded card and this component can share styling.
   - Action: Harmonize the `ServerCard` markup with the new `common` card classes and make top accent use the CSS var pattern.

5) `web/site/frontend (old)/src/components/ServerDetails.tsx`
   - Relevance: Contains additional server-specific labels, UI, and references to `anarchy` (e.g., 'mods' vs 'plugins'). Useful when extracting detailed server UI.
   - Action: Keep as-is but ensure style class names line up with `common/styles` so the details modal picks up consistent look.

6) `web/site/frontend (old)/src/utils/clickSound.ts`
   - Relevance: Selectors reference `.server-card` — indicates JS behavior bound to home/server-card elements.
   - Action: Ensure any renaming of `.server-card` or class structure preserves the selectors used by global utilities or update those utilities accordingly.

7) Other style or component files with matches
   - `components/VCPage.css` — comments indicate it expects server-card / panel colors used on home page.
   - `components/PasskeyAuth.css`, `components/LoadingScreen.css`, `components/PermissionsPage.css` — contain overlapping color palettes and layout rules which may be duplicated with Home page styles.
   - Modules referencing ServerCard: `src/modules/server_management/components/ServerCard.tsx` (re-export) — watch for multiple copies of ServerCard.

Files with isolated homepage strings / references (less central but found during scan)
-------------------------------------------------------------------------------
- `src/modules/server_management/index.ts` — re-exports pointing to `components/ServerCard`.
- `src/modules/server_management/components/ServerCard.tsx` — thin re-export wrapper.
- `src/components/ServerDetails.tsx` — detailed server modal (already listed).
- `src/components/VCPage.tsx` & `VCPage.css` — uses similar panel styles and comments referencing home styles.
- `src/utils/*` — utility code that may target `.server-card` or `.server-banner`.

What I extracted (artifacts)
----------------------------
- `frontend/src/pages/common/homepage.MD` — previously created summary of HomePage and colors.
- `frontend/src/pages/common/homepage_scatter.MD` — this file you’re reading now, listing all scattered sources.

Next recommended steps (small, safe steps)
-----------------------------------------
1. Create a central source of truth for server metadata
   - Move server definitions (id, name, color, default status) from `App.tsx` into `frontend/src/pages/common/data/servers.ts` (or read from API). Update `App.tsx` and `HomePage.tsx` to import that data.

2. Migrate styles to `common/styles` and replace inline color values with variables
   - Convert `.server-card`, `.server-banner`, `.server-cards`, `.countdown-timer` from `App.css` into `common/styles/cards.css` and `common/styles/utilities.css` (we already created these files earlier). Replace hard-coded colors with variables in `common/styles/variables.css`.

3. Normalize server card implementation
   - Make `ServerCard` use `--server-banner-start` / `--server-banner-end` CSS variables and `common` classes so the embedded home server card and the admin `ServerCard` are identical in appearance.

4. Centralize dynamic logic
   - Move `checkServerStatus()` into `common/utils/serverStatus.ts` and `checkAuth()` into `common/utils/auth.ts` (some of this is already done). Update `HomePage.tsx` and `App.tsx` to use these helpers.

5. Replace inline containers in `HomePage.tsx` with smaller components
   - `AnarchyBanner`, `CountdownTiles`, `TrailerPanel`, `HowToJoinCard`, `ContactCard`, `RulesPanel` — keep props minimal (`isLaunched`, `serversOnline`, `isMobile`), and style via classes.

6. Update global utilities and scripts that reference `.server-card`
   - `utils/clickSound.ts` and any other code that queries the DOM should be updated if classes are renamed; better: keep class names stable and update CSS variables only.

Progress & next action I can take now
------------------------------------
- I scanned the codebase and created this summary file.
- I can now:
  A) Replace inline colors and styles in `HomePage.tsx` with `common` classes and variables (non-breaking, safe edits). OR
  B) Extract the large sections into new components and wire them into `HomePage.tsx` (larger change, but better structure).

Which do you want next? If you prefer (A), I will:
- Edit `HomePage.tsx` to remove inline style objects and apply classes (e.g., `.announcement-banner`, `.anarchy-banner`, `.countdown-tiles`, `.trailer-panel`, etc.).
- Add any missing CSS class rules to `frontend/src/pages/common/styles/*.css` and map the inline colors to CSS variables.

If you prefer (B), I will:
- Create small components under `frontend/src/pages/common/components/` (e.g. `AnarchyBanner.tsx`, `CountdownTiles.tsx`, `TrailerPanel.tsx`) and move markup/logic there, updating `HomePage.tsx` to import and use them.

Tell me which approach you want (A or B) and I will start implementing it. If you want me to just continue scanning for anything I missed, say so and I’ll run a broader keyword sweep (more keywords or full-text search for inline style objects `style={{` across the frontend-old folder).