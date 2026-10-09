# Demo script and video plan

Type: grilling (HITL)
Status: resolved
Blocked by: 06, 07, 08

## Question

What exactly happens in the live demo and in the recorded video, beat by beat, timed?
- the story and the Reviewer persona
- which sample receipts are scanned live and which Findings they trigger
- which questions are asked
- how "no cloud" is proven (recorded internet-off segment plus a network monitor)
- the fallback if live extraction fails (pre-loaded data)
- how the same footage serves the submission video and the LinkedIn post

Each beat should map to a judging criterion.

## Answer

**The full script is in [research/09-demo-script.md](../research/09-demo-script.md).** Key decisions:
- **Name:** **Tally**. Vouch (the audit term) was first picked; the user switched to Tally afterwards.
- **Format:** 5 min pitch/demo + 3 min Q&A. The user narrates and drives the dashboard; the teammate runs the phone, the network monitor and the clip.
- **Story:** the contact's real numbers (₱15,000 advanced, ₱14,500 spent, ₱500 returned), framed as "a real liquidation from an accountant we interviewed".
- **Beats:** each is mapped to a judging criterion.
  1. Problem
  2. Why local
  3. QR capture with 2 live receipts (the synthetic ✅ Petron and the 2022 Official Receipt)
  4. Live toggle of the Buyer Details Rule, plus the duplicate and a Reviewer correction
  5. 3 questions, two in Taglish (amount to return, duplicates, what still needs review)
  6. Approve blocked, then resolved and approved, then the Excel summary and SLSP exports
  7. The internet-off clip and the accuracy line
- **No-cloud proof:** a recorded clip (phone hotspot with mobile data off, `ping` failing) plus a network monitor visible live.
- **Fallback:** pre-seeded data with ~8 processed receipts; only 2 are scanned live. Pre-flight at T-5 min: warmup, health check, close apps.
- **Q&A:** 6 prepared answers. The teammate takes deployment and e-invoices; the user takes the technical questions.
- **Videos:** one recording, two cuts: a ~2 min submission video and a ~60 s vertical LinkedIn video with captions.

## Comments
- From Checks and Disallowed Amount rules: demo beats include 1–2 synthetic receipts with Bayanihan Demo Corp's TIN handwritten on the buyer lines (accepted), the live Buyer Details Rule toggle that recomputes the Liquidation, a cross-Liquidation duplicate rejected, and a Reviewer correcting a misread amount.
- From Question set and query approach: demo questions were #2 (input VAT lost and why), #4 (spend by category), #6 (duplicates) and one Taglish question; show the "how I got this" line.
- From the first rehearsal (2026-10-09): #2 gives weak numbers on the demo data (₱30.43 for April, none this quarter), so the demo asks #3 (Taglish), #6 and #7 (Taglish) instead. #7 sets up the approve-blocked beat.
- From API contract and live events: demo beats available include scanning the QR to open phone capture, `receipt.ocr_done` text appearing in under 1 s while extraction runs (~15 s), the Buyer Details Rule toggle recomputing live, async question answers, and `GET /api/health` / `POST /api/admin/warmup` as pre-flight.
