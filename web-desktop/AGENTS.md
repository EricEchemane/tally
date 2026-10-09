<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Tally desktop dashboard

- Design decisions (layout column, card inset, shapes, colour, motion, wording) and the user's explicit choices: `DESIGN.md`. Read it before changing how anything looks; update it when a request changes a decision.
- After changing a page or component, run `npm run check:layout` and look at the pages in WebKit (the app's window is WKWebView): the `ui-check` skill.
