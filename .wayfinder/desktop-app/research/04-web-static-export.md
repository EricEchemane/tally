# What breaks when web/ becomes a static export

Answers [issue 04](../issues/04-web-static-export.md). Researched 2026-10-09 against Next.js 16.4.0 (`web/node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, `.../generate-static-params.md`) and tested by building a throwaway copy of `web/` with `output: 'export'` and serving the result through Starlette 1.7 / FastAPI 0.143 (`TestClient`, no real ports).

## Summary

- **Two config flags are hard blockers.** With `output: 'export'`, `cacheComponents: true` fails at build with `Invariant: PPR cannot be enabled in export mode`. `partialPrefetching` can't stay without `cacheComponents` (`partialPrefetching requires cacheComponents`). Both have to go. Nothing in the app needs them: every page is a client component that fetches data with react-query.
- **The three `[id]` routes are the only real code change.** The build stops with `Page "/receipts/[id]" is missing "generateStaticParams()"`. The fix: move each to a plain route that reads `?id=` with `useSearchParams()`: `/liquidations/?id=5`, `/receipts/?id=9`, `/capture/?id=5&t=…`. All three pages are already `"use client"` and already wrapped in `<Suspense>`, so each one changes by about 2 lines. The links that point at them change in 6 web files and 2 API files (Ask Tally answer links and the capture QR URL), plus their test assertions.
- **The `/api` and `/ws` rewrites only matter in development.** Every API call, image URL and the WebSocket are already same-origin and relative (`fetch("/api/…")`, `` `${proto}://${location.host}/ws` ``). Under FastAPI on one port they work unchanged. `next dev` still applies the rewrites when `output: 'export'` is set (it only warns, tested), so Simon's dev workflow stays the same.
- **Nothing else blocks the export.** There is no middleware/proxy, no route handlers, no Server Actions, no `cookies()`/`headers()`, no `next/image`, and no `next/font` (system fonts only, `globals.css:86-88`). The two server layouts are static.
- **One quiet bug:** the SLSP month picker's initial value and its download link are rendered at build time. The export currently bakes in `month=2026-10`. React doesn't patch mismatched attributes on hydration, so next month the link would still download October until the user touches the picker. Fix: set the month in `useEffect`.
- **How FastAPI serves it:** `trailingSlash: true` (each route becomes `out/<route>/index.html`, so plain `StaticFiles(html=True)` finds it) plus `skipTrailingSlashRedirect: true` (otherwise `next dev` 308-redirects `/api/x` to `/api/x/`). Mount it last at `/`. Use a 10-line `StaticFiles` subclass that adds the cache headers and returns a JSON 404 for unknown `/api/*`. No SPA catch-all is needed, because every page is a real file. Total work: roughly half a day for Simon plus about an hour for Eric on the API side.

## Changes

| # | File | What breaks | Fix | Size |
|---|------|-------------|-----|------|
| 1 | `web/next.config.ts:8` | `cacheComponents: true` → build error `PPR cannot be enabled in export mode` | Delete the line | S |
| 2 | `web/next.config.ts:9` | `partialPrefetching: true` requires `cacheComponents` → build error | Delete the line | S |
| 3 | `web/next.config.ts` (new keys) | No export output | Add `output: "export"`, `trailingSlash: true`, `skipTrailingSlashRedirect: true` | S |
| 4 | `web/next.config.ts:12-17` | `rewrites` are ignored in the export (build warning only) | Keep for `next dev`; optionally return them only in the dev phase to silence the warning | S |
| 5 | `web/src/app/(dashboard)/liquidations/[id]/page.tsx:5,18` | Dynamic route with no `generateStaticParams` → build error | Move to `liquidations/page.tsx`; `useParams` → `useSearchParams().get("id")` | S |
| 6 | `web/src/app/(dashboard)/receipts/[id]/page.tsx:5,17` | Same (this is the route the build actually reports) | Move to `receipts/page.tsx`; same 2-line change | S |
| 7 | `web/src/app/capture/[id]/page.tsx:4,12` | Same | Move to `capture/page.tsx`; read `id` and `t` from `useSearchParams()` | S |
| 8 | `web/src/app/(dashboard)/page.tsx:83,137` | Links/`router.push` to `/liquidations/${id}` → 404 | `/liquidations/?id=${id}` | S |
| 9 | `web/src/app/(dashboard)/liquidations/[id]/page.tsx:145,196` | Links to `/receipts/${id}` | `/receipts/?id=${id}` | S |
| 10 | `web/src/app/(dashboard)/receipts/[id]/page.tsx:37,157,349` | Crumb, related-finding link and post-delete `router.push` to `/liquidations/${id}` | `/liquidations/?id=${id}` | S |
| 11 | `api/questions/templates/__init__.py:152,206,264,305` | Ask Tally answer links (`href: "/receipts/1"`, `"/liquidations/1"`), rendered by `QuestionsPanel.tsx:210` → 404 | `f"/receipts/?id={…}"`, `f"/liquidations/?id={…}"` | S |
| 12 | `api/tests/test_question_templates.py:89,126,183,196,214` | Assert the old hrefs | Update expected strings | S |
| 13 | `api/routes/liquidations.py:78` | Capture QR URL `…/capture/{id}?t=…` → 404 on the phone | `f"{config.WEB_URL}/capture/?id={liquidation_id}&t={token}"` | S |
| 14 | `api/tests/test_scaffold.py:101` | Asserts `/capture/{lid}?t=` | Assert `/capture/?id={lid}&t=` | S |
| 15 | `web/src/app/(dashboard)/page.tsx:189,198` | `useState(() => today().slice(0,7))` is prerendered at build: the exported HTML has `value="2026-10"` and `href="/api/exports/slsp.csv?month=2026-10"`; hydration doesn't fix the `href` | `useState("")` + `useEffect(() => setMonth(today().slice(0, 7)), [])` (the button is already disabled while empty) | S |
| 16 | `api/main.py:29-30` | Nothing serves the UI | Mount the export last at `/` with the `WebFiles` subclass below | S |
| 17 | `api/config.py:19` | `WEB_URL` defaults to `http://localhost:3000`: the QR code points at a port that no longer exists | Default it to the app's own LAN address and port (the port itself belongs to the app-lifecycle ticket) | S |
| 18 | `web/package.json:8`, `dev.sh:14-16` | `next start` refuses to run an export; `MODE=demo` breaks | Drop `start`; demo mode = `next build` then uvicorn alone on one port serving `web/out` | S |
| 19 | `web/src/app/(dashboard)/layout.tsx:5-6`, `web/src/lib/api.ts:1` | Comments describe Cache Components and the Next proxy | Reword; keep the `<Suspense>` (harmless, and the pages need theirs for `useSearchParams`) | S |
| 20 | `web/src/app/(dashboard)/liquidations/[id]/page.tsx:18` + `lib/queries.ts:21` | New edge case: `/liquidations/` with no `id` → `Number(null)=0` → query disabled → skeleton forever | Show "Liquidation not found" when `!id` | S |
| 21 | (optional) `api/main.py` | Old-style URLs (bookmarks, an old QR still on screen) 404 | Two `RedirectResponse` routes: `/liquidations/{id}` → `/liquidations/?id={id}`, the same for receipts and capture (keep `t`) | S |

Everything here is S. The only coordination point is that #5–#14 must land together: web links, API hrefs and tests in one PR.

## Details

### 1. Cache Components and Partial Prefetching (hard blockers)

I tested each flag on its own against a copy with `output: "export"`:

| Config | Result |
|---|---|
| `cacheComponents` + `partialPrefetching` | `Error: Invariant: PPR cannot be enabled in export mode` |
| `cacheComponents` only | same error |
| `partialPrefetching` only | ``Error: `partialPrefetching` requires `cacheComponents` to be enabled`` |
| neither | builds; 5 static routes; `out/` is 1.0 MB |

The generateStaticParams docs also say that with Cache Components a dynamic route's `generateStaticParams` must return at least one param ("empty arrays cause a build error"). That route is closed anyway by the invariant above.

What we lose: nothing the app uses. Cache Components is about server-rendered data (`"use cache"`, dynamic holes). Every page here is `"use client"` and fetches through react-query. The `<Suspense>` in `(dashboard)/layout.tsx:9` existed only to satisfy Cache Components' rule about reading the current time. It can stay. Without Cache Components the AppShell is simply prerendered at build with empty queries, then fills in on the client.

### 2. Dynamic routes → query parameters

Docs: "Dynamic Routes without `generateStaticParams()`" and "with `dynamicParams: true`" are unsupported in an export. IDs are database rows created at runtime, so they can't be listed at build.

**Recommended: query parameters.** I tested the build in the scratch copy:

```
app/(dashboard)/liquidations/[id]/page.tsx  →  app/(dashboard)/liquidations/page.tsx
app/(dashboard)/receipts/[id]/page.tsx      →  app/(dashboard)/receipts/page.tsx
app/capture/[id]/page.tsx                   →  app/capture/page.tsx

- const id = Number(useParams<{ id: string }>().id);
+ const id = Number(useSearchParams().get("id"));
```

`useSearchParams()` in an export makes the nearest `<Suspense>` render on the client only. All three pages already export `<Suspense><View /></Suspense>` (`liquidations/[id]/page.tsx:233`, `receipts/[id]/page.tsx:363`, `capture/[id]/page.tsx:97`), so the build passes with no further change. The exported `liquidations/index.html` is the shell plus an empty Suspense boundary that hydrates on the client.

Write hrefs with the trailing slash (`/liquidations/?id=5`). That matches the exported folder layout and avoids a 307 from Starlette. A link without the slash still works (Starlette redirects `/capture?id=1&t=abc` → `/capture/?id=1&t=abc` and keeps the query; tested).

**Rejected: keep `/liquidations/[id]` with a placeholder param plus a FastAPI catch-all.** You'd export `generateStaticParams() { return [{ id: "_" }] }` (this needs a server `page.tsx` wrapper, because the current page files are `"use client"` and can't export it), then have FastAPI serve `liquidations/_/index.html` for every `/liquidations/*`. Problems:
- `useParams()` hydrates with `"_"` from the prerendered payload, not with the real ID, so the page would have to parse `usePathname()` instead.
- Client-side navigation fetches per-route RSC payloads (`/liquidations/5/index.txt`, `__next.*.txt`). FastAPI would have to rewrite those too.

It's more code on both sides and more fragile across Next upgrades, all to keep a prettier URL in a desktop window that has no address bar. The only place a user sees a URL is the QR code, and the phone doesn't care.

### 3. `/api` and `/ws` rewrites

- `web/src/lib/api.ts:9`: `fetch(path)` with paths that all start with `/api/`. Same-origin, relative.
- `web/src/lib/live.tsx:30-31`: the WebSocket URL is built from `location.protocol` and `location.host`, so it's same-origin.
- Downloads (`ButtonLink href="/api/…"` at `(dashboard)/page.tsx:198` and `liquidations/[id]/page.tsx:125`), `thumbnail_url`/`image_url` (`api/serialize.py:64,123` emit `/api/receipts/{id}/image`) and `<img>` (`receipts/[id]/page.tsx:97`, `liquidations/[id]/page.tsx:194`) are all relative.

So in production nothing needs rewriting: FastAPI owns `/api/*` and `/ws` on the same origin. In development, `next dev` with `output: "export"` still proxies the rewrites. I tested this with a fake API on a scratch port: `GET /api/health` → 200 from the backend, plus the warning `Specified "rewrites" will not automatically work with "output: export"`. To silence the warning, export a function config and only add `rewrites` when `phase === PHASE_DEVELOPMENT_SERVER`. That's optional.

**The trailing-slash trap (tested):** with `trailingSlash: true` alone, `next dev` answers `GET /api/health` with `308 → /api/health/` before the rewrite runs. FastAPI would then redirect `/api/health/` back to `/api/health`, and a POST through a 308 is replayed. `skipTrailingSlashRedirect: true` fixes it: `/api/health` was proxied directly, and `/liquidations?id=1` still rendered. Both keys go in together.

### 4. Images, fonts, middleware, server code

| Feature | In this codebase | Export impact |
|---|---|---|
| `next/image` | not used (plain `<img>`) | none |
| `next/font` | not used; system font stacks in `globals.css:86-88` (offline by design) | none |
| `favicon.ico` in `app/` | exported to `out/favicon.ico` | none |
| `public/*.svg` | create-next-app leftovers, unreferenced | none (can be deleted) |
| `middleware.ts` / `proxy.ts` | none | none |
| Route handlers (`route.ts`) | none | none |
| Server Actions, `cookies()`, `headers()`, `draftMode` | none | none |
| Server components | `app/layout.tsx` (static `metadata`/`viewport`), `(dashboard)/layout.tsx` | prerendered at build; fine |
| `redirects`/`headers` in config | none | none |
| `allowedDevOrigins` | dev only | ignored by the build; keep |

**Build-time evaluation (#15).** Without Cache Components, client components are prerendered once, at build. Anything that reads the clock or browser state during render is frozen into the HTML:
- `(dashboard)/page.tsx:189`, `SlspExport`'s `useState(() => today().slice(0, 7))`. Confirmed in `out/index.html`: `value="2026-10"` and `href="/api/exports/slsp.csv?month=2026-10"`.
- `(dashboard)/page.tsx:121` (`released`) is safe: `NewCashAdvance` only mounts after a click.
- `live.tsx` and `QuestionsPanel.tsx:47` touch `location`/`window` only inside `useEffect`, so they're safe.

### 5. How FastAPI should serve the export

What the export produces (`trailingSlash: true`):

```
out/index.html  out/404.html  out/favicon.ico
out/liquidations/index.html  out/liquidations/index.txt  out/liquidations/__next.*.txt
out/receipts/…  out/capture/…  out/_not-found/…
out/_next/static/chunks/*.js|*.css   (content-hashed)
```

Recommended addition to `api/main.py`, after the routers and `ws` (tested with `TestClient`):

```python
import mimetypes
import os
from pathlib import Path

import config
from fastapi import HTTPException
from starlette.staticfiles import StaticFiles

# Windows can map .js to text/plain through the registry; browsers then refuse the scripts.
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

class WebFiles(StaticFiles):
    """The Next.js static export. Hashed assets cache forever; pages always revalidate."""
    async def get_response(self, path, scope):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)  # unknown API path: JSON 404, not the HTML 404 page
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = (
            "public, max-age=31536000, immutable" if path.startswith("_next/static/") else "no-cache"
        )
        return resp

WEB_DIR = Path(os.environ.get("TALLY_WEB_DIR", config.ROOT.parent / "web" / "out"))
if WEB_DIR.is_dir():  # dev without a build: API only, as today
    app.mount("/", WebFiles(directory=WEB_DIR, html=True), name="web")
```

Results observed:

| Request | Result |
|---|---|
| `/` | 200 `index.html`, `no-cache` |
| `/liquidations/?id=3`, `/receipts/?id=1`, `/capture/?id=1&t=abc` | 200 the page's `index.html` |
| `/liquidations`, `/capture?id=1&t=abc` | 307 → trailing-slash URL, query kept |
| `/liquidations/index.txt`, `/liquidations/__next._tree.txt` (RSC payloads for client navigation) | 200 `text/plain` |
| `/_next/static/chunks/*.js` | 200 `text/javascript`, `max-age=31536000, immutable` |
| `/nope`, `/liquidations/5` | 404 with `out/404.html` (Starlette's `html=True` does this) |
| `/api/health` | 200 JSON (router wins, since the mount comes last) |
| `/api/missing` | without the guard: 404 **HTML**; with the guard: 404 `{"detail":"Not Found"}` |
| `/ws` | WebSocket route still works with the `/` mount after it |

Notes:
- **No SPA fallback.** With query-param routes every page is a real file, so serving `index.html` for unknown paths would only hide typos. Let `404.html` handle them.
- **Cache headers.** `_next/static/*` filenames are content-hashed, so they get `immutable`. HTML and the RSC `.txt` files get `no-cache`, so an app update is picked up at once even if the WebView kept its HTTP cache. `no-cache` still allows ETag/Last-Modified revalidation (StaticFiles sends both), so reloads stay cheap.
- **Order matters.** `include_router(...)` for every router, including `ws`, must come before `app.mount("/")`. A mount at `/` catches everything that isn't matched first.
- **Paths in the bundled sidecar.** `TALLY_WEB_DIR` lets the packaging ticket point at the folder inside the bundle (e.g. under PyInstaller's `sys._MEIPASS`) without touching this code again.
- **`WEB_URL` (#17).** The QR code must carry the server's own LAN IP and port. Today `dev.sh:9-10` computes it for port 3000. In the app, the sidecar should compute it at startup for whatever port it binds. That belongs to the app-lifecycle/port question in the map's "Not yet specified".

### 6. Not verified

- **Client-side navigation in a real browser.** I verified it with curl/`TestClient` only: the RSC `.txt` files are served, but I did not click through `Link`s in a browser. Simon should do a 2-minute check after the change: Cash Advances → a Liquidation → a Receipt → delete → back, plus Ask Tally links and the phone QR.
- **Windows MIME mapping.** The `.js → text/plain` registry problem is a known Python-on-Windows issue, not something I reproduced here. The `add_type` lines are a cheap guard.

Scratch build used for all of the above: `/private/tmp/claude-501/-Users-ericechemane-Desktop-ENGINEEX-local-ai-project/a16250a9-02b5-4bb2-96e3-a195ab610fb7/scratchpad/web` (`web/` itself untouched).
