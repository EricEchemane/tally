# Tally desktop design

The decisions behind the desktop dashboard's look, and the reasons. Values (colours, radii, timings) live in `src/app/globals.css` and the primitives in `src/components/ui.tsx`. This file records *why* and the user's explicit choices, so a later change doesn't quietly undo one. When a request changes a decision, update this file in the same change.

## Layout

- **Two columns, one centre:** `PAGE` and `CONTENT` in `ui.tsx`. The top bar uses `PAGE`: full width with 24 px gutters, capped on very wide screens. The page, the setup banner and the footer use `CONTENT`: the same column with **breathing room**, 40 px inside the bar's edges on each side (16 px below 1024 px). The user wanted the navigation visibly wider than the content, so it reads as the top-level frame.
- **Same title height:** every page title starts at the same height. `PageHeader` always reserves the breadcrumb row, empty on top-level pages.
- **Card inset, 24 px:** card titles, `CardBody` content, list rows (`CardList` 8 px + `ROW` 16 px) and table cells all start 24 px in from the card edge.
- **Exceptions:** the setup wizard and the phone capture page are their own narrow centred columns, with no top bar.
- `npm run check:layout` enforces the breathing room on both sides, the title height and the inset. See the `ui-check` skill.

## Shape

- **Fully rounded** controls: buttons, inputs, selects, tabs, toggles, status pills and chips.
- **Panels:** cards, stat tiles and dialogs are `rounded-3xl`; anything inside a panel is `rounded-2xl`.
- **The one exception:** the top bar container is `rounded-2xl`, like a macOS toolbar. The user asked for exactly this and nothing else. An app-wide Apple-radius pass was tried and reverted.

## Surfaces

- **Borders, no shadows:** cards, tiles, buttons and inline forms use soft borders only.
- **Shadows** only on what floats above the page: the top bar, the Ask Tally panel, dialogs, toasts and the phone's bottom bar.
- **Background:** near white. Neutral grays (not warm beige) for inactive pills, tracks and hovers.

## Colour

- **Deep emerald accent.** White text on it and it as text on the page both pass WCAG AAA. The "Accepted" and approval greens are the same colour, so the app has one green.
- **Contrast:** every text colour must pass WCAG AA (4.5:1). Check new colours with a contrast calculation before choosing them.

## Tabs and toggles

- **Active state:** a raised white segment with a hairline border and dark semibold text, on a light gray track (macOS segmented). One `Segmented` component, plus the same look in the top-bar navigation. The highlight slides between options.

## Motion

- **Subtle and fast:** 120–250 ms, opacity and transform only.
- **Moments that signal change:** a status that lands pops once; a total that changes flashes green (good news) or red (bad).
- **Numbers never animate:** an accounting screen never shows an amount that isn't real, so no count-up.
- **Page changes crossfade** through React `<ViewTransition>`. Lists cascade. Dialogs scale in.
- **Ask Tally** is the one expressive place: gradient button, springing panel, a thinking track, and answers revealed word by word. Everything else stays calm.
- **Reduce motion:** with macOS "Reduce motion" on, everything is instant except loading indicators.

## Home page

- **Scanning is the page's main action:** a plain "Scan receipts" button (primary), with "New Cash Advance" beside it, and photos can be dropped anywhere on the page. The user rejected a feature card with a glow, a gradient badge, onboarding steps and marketing copy as cluttered "AI slop", so highlight by placement and hierarchy, not decoration.
- **A receipt always belongs to a Liquidation,** so scanning starts with "For which Cash Advance?". It's skipped when only one is open; when none is, New Cash Advance comes first. While the AI works, the subtitle says "Reading N receipts…".
- **No phone QR code on the home page:** it would need a capture link not tied to one Liquidation.

## Words

- **Accountants' terms stay:** Cash Advance, Liquidation, Disallowed Amount, Finding, Particulars (see `GLOSSARY.md`).
- **Plain words for the technical ones:** "AI ready" rather than model names, "Accept anyway" rather than "Dismiss". Ollama is named only in setup and Settings.

## Engine

- **WebKit:** the Mac app's window is WKWebView, so UI is verified in WebKit, not Chrome. Chrome hides real bugs here, such as `position: relative` on table rows.
