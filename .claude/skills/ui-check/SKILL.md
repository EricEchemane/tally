---
name: ui-check
description: Check the Tally desktop dashboard (web-desktop/) in WebKit. Use after changing a page or component, to run the layout check, take screenshots, or drive a page with Playwright against a throwaway backend.
---

The Mac app's window is WKWebView, so every check runs in WebKit (`playwright-core`'s `webkit`), never Chrome. Run from `web-desktop/`.

1. **Layout:** `npm run check:layout`. It builds, starts a throwaway backend, and measures every dashboard page at 1280 and 1600 px against `DESIGN.md`'s layout rules: one column edge, same title height, 24 px card inset. Done when it prints `Layout check passed`. A failure names the page, the element and the measured value. Fix the markup with `PAGE`, `CardBody`, `CardList` and `ROW` from `src/components/ui.tsx`, not with one-off padding.
2. **Look:** `node scripts/layout-check.mjs --shots <dir>` saves a full-page screenshot of each page, then read the images. A new page or a new card style goes into `PAGES` in `scripts/layout-check.mjs` so the check covers it.
3. **Interact:** for clicks, dialogs and animations, `import { startBackend } from "./scripts/ui-backend.mjs"` (`{ url, stop }`). It has demo data, the fake AI pipeline, setup already complete, a fresh temp folder and a free port, and serves the last `next build`. `npm run ui:backend` runs the same thing by hand. Done when the interaction behaves in WebKit with no `pageerror`.

A WebKit browser missing on a new machine: `npx playwright-core install webkit`.
