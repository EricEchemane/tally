# UI pipeline: who touches the frontend, in what order

Every UI change in `site/` (marketing) and `web/` (app) goes through these four
skills in this order. Each skill owns one layer and doesn't redo another's work.

| # | Layer | Skill | Owns | Output |
|---|---|---|---|---|
| 1 | Context and intent | `impeccable` | Product truth, surface mode, scope | `PRODUCT.md`, `DESIGN.md`, a `shape` plan |
| 2 | Aesthetic direction | `design-taste-frontend` | Design Read and the three dials | One Design Read line plus VARIANCE / MOTION / DENSITY |
| 3 | Spec and build | `ui-ux-pro-max` | Palette, type, layout, components, a11y rules | Code that uses `design/tokens.css` |
| 4 | Motion | `design-motion-principles` | Every transition, hover, enter/exit, micro-interaction | Motion code (Create mode) |
| 5 | Finalization | all four (see below) | Sign-off | Clean audits, localhost preview, PR |

## 1. Context: `impeccable` goes first

- Run its launcher once per session: `.claude/skills/impeccable/scripts/impeccable.cmd context --target <file-or-route>`.
- No `PRODUCT.md` yet? Run `impeccable init`. For an existing codebase, run `impeccable document` to generate `DESIGN.md` from the code and `design/tokens.css`.
- Pick the surface mode: `site/` is **Persuade**, and `web/` is **Operate**.
- Use `impeccable shape <feature>` to plan the UX before any code.

## 2. Direction: `design-taste-frontend`

- Write the one-line Design Read: *"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <system>."*
- Set the three dials: DESIGN_VARIANCE, MOTION_INTENSITY and VISUAL_DENSITY.
- **`site/` only.** The skill is built for landing pages, portfolios and redesigns. In `web/` (dashboards, tables, multi-step UI), skip this layer and use only `impeccable`'s Operate guidance.

## 3. Spec and build: `ui-ux-pro-max`

- Turn the Design Read into concrete choices with the search tool, run from the repo root:
  `python .claude/skills/ui-ux-pro-max/scripts/search.py ...`
- New colors, fonts and spacing go into `design/tokens.css` (synced by `design/sync-tokens.mjs`). Don't hard-code values in components.
- Read `impeccable`'s `reference/craft-floor.md` before writing any UI code. It lists the absolute bans.
- Build the layout, components and states. Leave motion for layer 4.

## 4. Motion: `design-motion-principles`

- **Create mode.** The MOTION_INTENSITY dial from layer 2 sets how much motion there is.
- Lens weighting: `site/` is Marketing/landing (Jakub first, Jhey second, Emil for forms and nav). `web/` is SaaS dashboard (Emil first, Jakub second, Jhey only for empty states).
- This is the only skill that writes motion. Don't use `impeccable animate` or the taste skill's motion recipes on top of it.
- Always honor `prefers-reduced-motion`.

## 5. Finalization: the sign-off gate

Run these in order. Fix what each one finds before moving to the next.

1. `impeccable critique <target>`: UX and visual-hierarchy review with heuristic scores.
2. `impeccable audit <target>`: technical checks (a11y, performance, responsive).
3. `ui-ux-pro-max` pre-delivery checklist: contrast, touch targets, focus states, forms, typography.
4. `design-motion-principles` **Audit mode**: catches AI-slop motion and over-animation.
5. `design-taste-frontend` pre-flight check (`site/` only): no template defaults, and the result still matches the Design Read.
6. `impeccable polish <target>`: the **last** touch. It's a single bounded pass, not a loop.
7. Preview on localhost (`cd site && npm run dev`, port 3001) at both desktop and mobile widths. Then open a PR. Never push to `main`.

## When the skills disagree

1. The brief and the existing tokens in `design/tokens.css`
2. Accessibility (`ui-ux-pro-max`, `impeccable audit`)
3. `impeccable` craft-floor bans
4. The taste skill's aesthetic direction and dials
5. Motion lens preferences
