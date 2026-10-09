# Map: Tally PH Market Site

Label: wayfinder:map

## Destination

A launched, public **Tally PH** marketing site (`site/`, on a free Vercel subdomain) that hackathon judges and Testers can use to understand Tally, try it, and send feedback, and that Prospects can use to send an Early Access Request.

## Notes

- **Execution is carried into this map.** Unlike the liquidation-review map, most tickets here are build tasks: the decisions were made in one grilling session, recorded in [Market page plan](issues/01-market-page-plan.md). Read that ticket before taking any other.
- **Domain:** marketing for the liquidation review app. New terms (**Prospect**, **Early Access Request**, **Tester**) are in the Market section of [GLOSSARY.md](../../GLOSSARY.md) (added in PR #4); use them in copy, code and tickets.
- **Ownership:** `site/` and `web/` are Simon's. Nothing in this map touches `api/` (Eric's).
- **Design:** reuse the calm-ledger tokens from `web/src/app/globals.css`; see [Shared design tokens](issues/02-shared-design-tokens.md). The app stays on system fonts; only the site may load a web font.
- **Next.js:** `web/AGENTS.md` warns this Next.js version differs from training data. Read `node_modules/next/dist/docs/` before writing site code.
- **Skills:** grilling tickets call `grilling` and `domain-modeling`; prototype tickets produce something rough to react to.

## Decisions so far

<!-- the index: one line per closed ticket -->
- [Market page plan](issues/01-market-page-plan.md): Separate `site/` for the real buyer (finance head); 5 pages, no pricing; hero "Spot the slip before the audit trip.", closing "Every peso, proven."; interactive sample review of 3 real receipts; Early Access Request + Tester feedback forms with DPA consent; Try page installs from the public repo; English with a Tagalog switch; cookieless analytics; no cloud accounts.

## Not yet specified

- **Home page section order beyond the hero and closing banner:** which proof points (time saved, the accountant's ₱15,000 story, "zero egress"), and whether there are logos/quotes. Graduates once the type scale exists (see Display font and marketing type scale).
- **Open Graph image and social preview:** what the LinkedIn/Messenger card looks like when the link is shared.
- **Spam protection on the forms:** honeypot vs a captcha (a captcha may need cookies; see the analytics decision).

## Out of scope

- **Pricing page:** no pricing during the hackathon; judges and Testers use it free. See [Market page plan](issues/01-market-page-plan.md).
- **Cloud accounts / hosted Tally:** breaks the "no cloud" promise.
- **Local Reviewer login in the app:** needed (the dashboard is open to the LAN) but it touches `api/routes/`; it is a separate, later plan.
- **Custom domain, blog, docs portal, Tagalog in the app itself:** after the hackathon, if Tally continues.
