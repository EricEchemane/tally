# What breaks when web/ becomes a static export

Type: research (AFK)
Status: resolved
Assignee:
Blocked by: none

## Question

If `web/` (Next.js 16.4) is built with `output: 'export'` and served by FastAPI, what in the current code stops working, and what is the smallest change for each?
- the `/api/*` and `/ws` rewrites (no Next server any more)
- the `[id]` dynamic routes: `/liquidations/[id]`, `/receipts/[id]`, `/capture/[id]`
- `cacheComponents`, `<Suspense>` around `useParams()`, any server components or route handlers
- how FastAPI should serve the export (fallback routing for client-side pages, cache headers)

This is a read of the codebase plus the Next.js docs. The answer is a list of changes for Simon, with their size.

## Answer

**Full findings are in [research/04-web-static-export.md](../research/04-web-static-export.md)** (tested by building a throwaway copy with `output: 'export'` and serving it through Starlette). 21 changes, all small:
- **Build blockers:** delete `cacheComponents` and `partialPrefetching` from `next.config.ts`. Every page is already a client component using react-query, so nothing is lost.
- **Dynamic routes:** `/liquidations/[id]`, `/receipts/[id]` and `/capture/[id]` become `?id=` query routes using `useSearchParams`. Update the links in 6 places in `web/`, plus the API-built links: the question-answer hrefs, the capture QR URL and their tests.
- **`/api` and `/ws` need no change:** all calls are same-origin and relative. Add `trailingSlash: true` and `skipTrailingSlashRedirect: true`.
- **FastAPI:** mount a small `StaticFiles(html=True)` subclass at `/` after the routers. It sets immutable caching on `_next/static`, no-cache on pages, and a JSON 404 for unknown `/api/*`. Register the `.js`/`.css` MIME types (a Windows guard). Also: a `WEB_URL` default that isn't port 3000, and a new demo mode, since `next start` is gone.
- **Bug found:** the SLSP export month on the dashboard (`web/src/app/(dashboard)/page.tsx:189`) is fixed at build time. Fix: compute it in `useEffect`.
- **Not verified:** client-side navigation in a real browser, and the phone QR after the change.
