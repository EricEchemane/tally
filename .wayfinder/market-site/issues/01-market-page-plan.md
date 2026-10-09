# Market page plan

Type: grilling (HITL)
Status: resolved

## Question

What is the Market page for, and what goes into it: landing, registration/login, calls to action and the design system, so that Tally stands out?

## Answer

**Audience and name**
- Written to the real buyer (the finance head or owner of a PH SME), with the Reviewer as the hero; that also convinces judges.
- Public name **Tally PH**. "Tally" alone competes with TallyPrime and Tally.so. Every page title carries "liquidation review".
- English copy with local cues (₱, BIR, EOPT, TIN), plus a Tagalog switch on the site only. English is the default and the choice is remembered. BIR and glossary terms stay in English. The user writes or checks the Tagalog; no machine translation.

**Site**
- A separate hosted site in this repo as `site/` (Next.js on Vercel, free subdomain such as `tally-ph.vercel.app`). The local app stays a tool and opens straight to work.
- Pages: **Home**, **How it works**, **Privacy & security**, **FAQ**, **Privacy notice**, plus **Try Tally**. No pricing page.
- Hero: **"Spot the slip before the audit trip."** / *BIR-checked liquidations, offline.* Detail goes in the sections below, not in the hero.
- Closing banner on every page: **"Every peso, proven."** above the primary CTA.
- Centrepiece: an **interactive sample review**. The visitor picks one of three real receipts and sees its Findings and the Amount to Return, scripted from the real pipeline output in `api/tests/fixtures/receipts/`:
  - `bayanihan-corp-1.jpg`: accepted
  - `mercury-drug-226-faded.jpeg`: seller TIN needs review
  - `or-cebu-2022-multi-finding.jpg`: Official Receipt, several Findings (blur the cardholder name and card number first)
- The 2-minute demo video is embedded on Home and Try once recorded; the launch does not wait for it.

**Calls to action, registration and login**
- Primary CTA **"Request early access"** creates an **Early Access Request** from a **Prospect**: name, work email, company, role, roughly how many Cash Advances are liquidated a month, and a required Data Privacy Act consent checkbox linked to the privacy notice. Stored in a small hosted database, with an email to the team for each one.
- Secondary CTA **"See it check a receipt"** scrolls to the interactive demo.
- **Try Tally** page for **Testers** (judges included): clone the public repo, run `./setup.sh` once with internet, then `./dev.sh`. Requirements stated up front (Mac, Homebrew, internet once); Windows runs only the fake pipeline, so Windows visitors are pointed to the interactive demo.
- **Tester feedback form** (what worked, what broke, which receipt confused it, optional email), stored in the same database, with a "Send feedback" link in the app's footer.
- **No cloud accounts.** "Login" means a local Reviewer login in the app, planned separately later (out of scope here).

**Design system**
- Reuse the calm-ledger tokens; move them into a shared file both `web/` and `site/` import. Add only what marketing needs: a display type scale, section spacing, and one heading web font (site only).

**Privacy**
- Cookieless analytics only (page views, CTA clicks, demo receipt picks); no cookie banner.
- The privacy notice names the team under the product name with one shared team email, not a personal one.
