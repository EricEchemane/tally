# Shared design tokens

Type: task (AFK)
Status: open

## Question

Move the calm-ledger tokens out of `web/src/app/globals.css` into one shared stylesheet that both `web/` and `site/` import, with the dashboard looking exactly the same afterwards.

- Colours (light and dark), shadows, `.num`, focus ring and the `pulse` / `enter` motion move as they are.
- Fonts stay per app: the app keeps system fonts; the site sets its own (see Display font and marketing type scale).
- Done when `web/` builds, `npx tsc --noEmit` and `npm run lint` pass, and the dashboard is visually unchanged in light and dark mode.
