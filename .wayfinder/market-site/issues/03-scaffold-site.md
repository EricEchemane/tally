# Scaffold the site and deploy it

Type: task (AFK, with one HITL step)
Status: open
Blocked by: 02

## Question

Create `site/` as its own Next.js app that imports the shared tokens, with an empty page per route (Home, How it works, Privacy & security, FAQ, Privacy notice, Try Tally), a shared header and footer with the two CTAs, and the closing banner ("Every peso, proven.").

- Every page title includes "Tally PH" and "liquidation review".
- Cookieless analytics wired up (page views, CTA clicks); no cookie banner.
- HITL: the user creates the Vercel project and picks the free subdomain (for example `tally-ph.vercel.app`).
- Done when a placeholder site is live at the subdomain and `README.md` says how to run `site/` locally.
