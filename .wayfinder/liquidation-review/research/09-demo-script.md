# Tally: demo script and video plan

**Name:** **Tally**, chosen by the user over Vouch. It reads as "the receipts tally with the cash advance". If the name is ever made public beyond the hackathon, note that TallyPrime (accounting software) and Tally (forms) exist.
**Tagline:** *Tally: every receipt checked against BIR rules, on your own laptop.*
**Format:** 5 min pitch/demo + 3 min Q&A, live and remote. Submission: video, public repo, LinkedIn post.
**Roles:** Both are in the same room. Eric narrates and drives the dashboard on the Mac. Simon holds the phone (on the Mac's network), watches the network monitor window, starts the internet-off clip, and takes the deployment and e-invoice Q&A questions.
**Story:** "A real liquidation from an accountant we interviewed": a ₱15,000 Cash Advance, ₱14,500 spent, ₱500 to return. Demo Company: Bayanihan Demo Corp (TIN 123-456-789-00000).

## Live demo (5:00)

| Time | Beat | Criterion |
|---|---|---|
| 0:00–0:30 | **Problem.** The accountant's words: receipts are checked by hand ("eyeballed"); a rejected receipt means the Employee pays the money back; "privacy is the priority". | Problem & usefulness (25%) |
| 0:30–1:00 | **Why local.** Liquidation reports and the SLSP are always confidential. Everything runs on this 8GB MacBook: Apple Vision OCR + qwen3:4b. The network monitor stays visible. | Local AI (25%) |
| 1:00–2:30 | **Core flow.** Open the ₱15,000 Cash Advance, already loaded with ~8 processed receipts. Scan the QR code; the phone opens capture. Snap 2 receipts live: the synthetic Petron with the Company TIN written on it (→ ✅), and the 2022 Official Receipt (→ REJECT, several Findings). The OCR text appears in under 1 s, the checks land around 15 s, and the totals update. | Execution, demo quality |
| 2:30–3:15 | **Rules come alive.** Switch the Buyer Details Rule from "all receipts" to "₱1,000+" and watch the Liquidation recompute with ✅s appearing. Point at a duplicate rejected that names the other Liquidation. Correct a misread amount on the blurry 7-Eleven receipt; the checks re-run. | Innovation, UX |
| 3:15–4:15 | **Questions.** Taglish: "Magkano ang ibabalik ni Juan?" ("How much does Juan have to return?"), then "Has any receipt been submitted twice?", then Taglish: "Ano pa ang kailangan kong i-review?" ("What do I still need to review?"), whose answer leads straight into the next beat. Show each answer's "how I got this" line. Skip the input-VAT question: on the demo data it answers with small sums (₱30.43 for April) or "none" for this quarter. | Local LLM |
| 4:15–4:45 | **Close the loop.** Approve is blocked (a receipt still needs review). Resolve it, approve, then download the Liquidation summary (Excel, with the accountant's columns) and the SLSP CSV. | Usefulness |
| 4:45–5:00 | **Proof.** Play the 20 s internet-off clip. One line: "90% of fields right on real receipts; the arithmetic check caught every wrong amount." | Local AI, execution |

## Proving there's no cloud

- **Recorded clip:** the phone's hotspot has mobile data **off** and the Mac joins it, so the LAN works with no internet. Show `ping google.com` failing, then QR → snap → findings → a question.
- **Live:** a network monitor (LuLu or a `nettop` terminal) stays visible the whole time. FastAPI and Ollama make no outbound connections.

## Pre-flight (T-5 min) and fallback

- **Machine:** close Chrome tabs and other apps (8GB; swap reached 3.9 GB during the benchmark). Run `POST /api/admin/warmup` and check that `GET /api/health` shows the model loaded and an empty queue. Phone and Mac on the same network; QR tested once.
- **Pre-seeded data:** 2 Liquidations with ~8 processed receipts, including the cross-Liquidation duplicate and the blurry 7-Eleven photo with a misread amount.
- **Only 2 receipts are scanned live.** If one fails: "this one's already processed", and open the pre-seeded copy.

## Q&A prep (3:00)

| Likely question | Answer | Who |
|---|---|---|
| Why not GPT-4 / Google Vision? | Liquidation reports and the SLSP are confidential (the accountant said so); cloud calls also cost per receipt and fail without signal. | Eric |
| How accurate is it? | 90% of fields on 13 real PH receipts; every wrong amount was caught by the VAT arithmetic check, so errors are flagged, never silent. | Eric |
| What if the AI misreads? | It rejects only on printed evidence; missing values go to the Reviewer; corrections are audited; code, not the AI, applies the BIR rules. | Eric |
| How would a company deploy it? | One Mac or mini-PC in the finance office with phones on the office Wi-Fi. A Windows version would need RapidOCR. | Simon |
| Why 15 s per receipt? | An 8GB laptop with a 4B model. Text shows in under 1 s, captures queue so the phone never waits; 16GB would be about 2–3x faster. | Eric |
| E-invoices and the 2026 mandate? | E-invoices skip OCR entirely, so that's next, plus falsification signals across Employees (duplicates are already caught). | Simon |

## Videos: one recording, two cuts

- **Submission cut (~2 min):** problem (accountant's words), then the internet-off flow end to end, then 2 questions, then why local.
- **LinkedIn cut (~60 s, vertical, captions burned in):** hook "₱500 of receipts rejected, eyeballed by hand", the phone snap, ✅ and ⚠️ appearing, then "runs offline on an 8GB MacBook. Tally."
