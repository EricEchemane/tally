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
- **Every action confirms itself:** a toast in the bottom-right corner (`toast()` in `src/lib/toast.ts`). Its icon draws in; it slides away after about 4 s, or 7 s for downloads with Show in Finder. Use one short title saying what happened ("Liquidation approved"), plus one line of consequence only when useful ("Totals are now frozen."). In-page notices carry an icon for their kind and fade in. A Liquidation's status pill pops when it changes.
- **Reduce motion:** with macOS "Reduce motion" on, everything is instant except loading indicators.

## Home page

- **Scanning is the page's main action:** a plain "Scan receipts" button (primary), with "New Cash Advance" beside it, and photos can be dropped anywhere on the page. The user rejected a feature card with a glow, a gradient badge, onboarding steps and marketing copy as cluttered "AI slop", so highlight by placement and hierarchy, not decoration.
- **A receipt always belongs to a Liquidation,** so scanning starts with "For which Cash Advance?". It's skipped when only one is open; when none is, New Cash Advance comes first. While the AI works, the subtitle says "Reading N receipts…".
- **No separate Liquidations page:** a Cash Advance and its Liquidation are 1:1, so a second list would repeat the first. Instead, the list's **Next step** column (replacing Status) says what the Reviewer does next: Scan receipts → Reading N receipts → Review N receipts → Ready to approve, or Waiting on Employee (Returned), or Done (Approved). That makes the list double as the review queue.
- **No phone QR code on the home page:** it would need a capture link not tied to one Liquidation.

## Money

- **Shown:** every amount with ₱, thousands commas and two decimals (`peso()`), in tabular figures.
- **Typed:** every amount field is a `MoneyInput`: ₱ inside the field, commas as you type, two decimals added on leaving the field. It accepts pasted `₱15,000.50`. The value sent to the API stays plain digits.
- **Create buttons** (New Cash Advance, Add Employee) carry a plus icon.

## Exports

- **Preview before download:** the Liquidation's **Summary** button opens a preview of the Excel summary, with Copy table and Download .xlsx. The preview and the file render the same backend data (`summary_data` in `api/exports`), so they can't disagree.
- **A document, not a spreadsheet dump.** Totals come first, then a table that fits without sideways scrolling: Date, Seller (TIN beneath), Particulars, the amounts, and Status with its deciding reason. Addresses and full Findings live in the file, in Copy table and on hover. One scroll area, with a sticky header. The first version mirrored all 11 file columns in a nested scroller and read as "off".

## Words

- **Accountants' terms stay:** Cash Advance, Liquidation, Disallowed Amount, Finding, Particulars (see `GLOSSARY.md`).
- **Plain words for the technical ones:** "AI ready" rather than model names, "Accept anyway" rather than "Dismiss". Ollama is named only in setup and Settings.

## Engine

- **WebKit:** the Mac app's window is WKWebView, so UI is verified in WebKit, not Chrome. Chrome hides real bugs here, such as `position: relative` on table rows.
