# Tally landing page: section reference

The reference for building the marketing site. It sets the order of the sections, what each one is for, and what it must say. The final wording and the visual design are up to you, within the rules below.

**Goal:** get finance teams at Philippine companies to **download the Mac app**. The secondary action is **watch the demo**. The site only promotes the app: there are no forms or accounts on it, and registration happens inside the installed app.

**Audience:** accountants and finance staff who check Liquidations, plus the finance heads and owners who decide to try it. Judges and other visitors should follow the page too, but it isn't written for them.

---

## Rules for the copy

**Vocabulary.**
- **Who it's for** (hero, problem, CTA): use the visitor's own words, such as "accountants and finance teams".
- **What the product does** (steps, features, screenshots): use [GLOSSARY.md](GLOSSARY.md) terms only: Liquidation, Cash Advance, Receipt, Finding, Correction, Dismissal, Valid Spend, Amount to Return. Don't write "expense report", "reimbursement", "error" or "override".

**Claims.** Only write what is true today and can be checked:
- **No accuracy percentage.** The 90% figure comes from 13 sample receipts. Claim how it works instead: a misread VAT amount is flagged, never passed silently.
- **The only speed number:** "about 15 seconds per receipt", always with the machine it was measured on (an 8 GB M1 MacBook Pro).
- **Platforms:** Mac only for now. Windows is "planned", never "coming soon" or a date.
- **Not built, so don't mention:** e-invoices and PDFs, integrations with accounting software, several Companies in one install, cloud sync.

**Tone:** calm, precise, written by people who know the BIR rules. Short sentences. No hype words ("revolutionary", "magic"), and no emoji in body copy. The ✅ and ⚠️ markers can appear in the product screenshots.

**The privacy promise:** use this wording in the privacy section and in the FAQ, changed as little as possible:

> Your receipts and tax data never leave your laptop. The internet is needed once, to set up; after that, Tally works offline. Your phone sends photos straight to your laptop over your office Wi-Fi.

---

## Sections, in order

### 1. Nav

- Logo "Tally" on the left.
- Links: How it works · Privacy · FAQ
- A **Download for Mac** button on the right. It stays visible on mobile.

### 2. Hero

**Purpose:** say in five seconds what it is, who it's for, and that it runs locally.

- **Headline:** "Every receipt checked against BIR rules, on your own laptop."
- **Subhead** (draft): "Snap the receipts in a Liquidation with your phone. Tally reads each one, checks it against the BIR rules, and shows what needs your attention. Nothing goes to the cloud."
- **Buttons:**
  - **Download for Mac** (primary)
  - **Watch the demo** (secondary): opens the 60–90 s demo video. Until the video exists, it scrolls to How it works.
- **Visual:** a happy accountant, with Tally's results (Accepted, Needs review, and so on) floating around her. The Liquidation dashboard, built from the demo data (Bayanihan Demo Corp), appears in How it works. Never use a real company.
- **Small line under the buttons:** "For Mac with Apple Silicon. Windows is planned."

### 3. Problem

**Purpose:** show the visitor their own day, in a real accountant's words.

- **Headline** (draft): "Receipts are still checked by eye."
- **Content:** three or four short points from the accountant interview (quoted anonymously as "an accountant who handles liquidations for Philippine companies"):
  - Every receipt is eyeballed.
  - It must be BIR-compliant and show the Company's name and TIN.
  - A rejected receipt means the Employee pays that amount back, so mistakes cost someone real money.
  - "Privacy is the priority." Consolidated reports and the SLSP are always confidential.
- **The bridge to the next section:** the last point, privacy.

### 4. Private by design

**Purpose:** the main difference from cloud receipt scanners, and the buyer's top concern. It comes before the features on purpose.

- **Headline** (draft): "Your tax data stays in the office."
- **Content:**
  - The privacy promise (see the rules above), word for word.
  - Three short supporting points:
    - **No cloud:** the AI runs on your laptop.
    - **Works offline:** once set up, no internet is needed.
    - **No cost per receipt:** checking a whole pile costs nothing extra.
- **Visual:** the internet-off clip (Wi-Fi off, receipt still processed), or a simple diagram: phone → office Wi-Fi → laptop, with a crossed-out cloud.

### 5. How it works

**Purpose:** make the workflow concrete. This is also where the hero's "Watch the demo" button scrolls to before the video exists.

- **Headline** (draft): "From a pile of receipts to an approved Liquidation."
- **Four steps:**
  1. **Scan.** Open the Cash Advance and scan its QR code with your phone, then photograph each receipt. Uploading files works too.
  2. **Read.** Your laptop reads each receipt in about 15 seconds (measured on an 8 GB M1 MacBook Pro). Receipts appear on the dashboard as they're done.
  3. **Check.** Each receipt is checked against the BIR rules and marked accepted or with its Findings.
  4. **Approve.** Correct anything misread, resolve the Findings, approve or return the Liquidation, and export.
- **Visual:** one image per step (the phone with the QR code, the receipt being processed, a receipt with a Finding, the Approve button with the totals).

### 6. What it checks

**Purpose:** show that Tally knows the rules. For an accountant, this is where it earns trust.

- **Headline** (draft): "The checks you'd do, on every receipt."
- **Intro sentence:** "Under the EOPT Act, Official Receipts no longer support input VAT claims. Tally knows."
- **A grid of six checks**, each with a one-line explanation:

  | Check | One-liner |
  |---|---|
  | Invoice or Official Receipt | Flags Official Receipts and receipts marked "not valid for claim of input tax". |
  | Buyer name and TIN | The buyer's TIN must match your Company's, on every receipt or from ₱1,000 up, as you choose. |
  | Seller TIN | It must be there and in the right format, branch code included. |
  | VAT arithmetic | VATable × 12% must equal the VAT, and the parts must add up to the total. If they don't, the receipt is flagged. |
  | Duplicates | The same receipt submitted twice, even in a different Liquidation. |
  | Spending Period | Receipts dated outside the Cash Advance's Spending Period. |

- **A line under the grid:** "Tally only rejects a receipt on what's printed on it. Anything it can't read clearly goes to you for review."

### 7. Review features: you stay in control

**Purpose:** answer "will the AI decide for me?" It doesn't.

- **Headline** (draft): "The AI reads. Code checks. You decide."
- **Two blocks:**
  - **Correct a misread.** Change any value Tally read. The checks re-run straight away, and the original reading is kept.
  - **Dismiss a Finding, with a reason.** The Finding stays visible as dismissed, so there's always a record.
- **Visual:** a receipt with a Correction next to the photo.

### Assistant (its own section, after "You stay in control")

- **Headline:** "Don't dig through files. Ask."
- **Message:** Tally's second AI feature. Besides reading receipts, the Assistant talks with you offline. Ask about your Liquidations in plain words (English only on the page). Answers come from your records, not guesses, and show how they were worked out. It reads and explains; it never changes a record.
- **Visual:** an app window with a short conversation that plays once on scroll: a question, the answer with its table, then "How I got this".

### 8. Exports

**Purpose:** show that the work ends in files the visitor already uses.

- **Headline** (draft): "Ready for your files and the BIR."
- **Two cards:**
  - **The Liquidation summary (Excel).** Valid Spend, Disallowed Amount and the Amount to Return, receipt by receipt.
  - **The SLSP-ready purchases CSV.** The purchases, ready for your SLSP.
- **Visual:** a cropped view of the Excel summary, using demo data.

### 9. Requirements

**Purpose:** say who can use Tally now, without promising Windows.

- **What you need:**
  - A Mac with Apple Silicon (M1 or later) and 8 GB RAM or more
  - Any phone with a camera, on the same Wi-Fi as the Mac
  - Internet once, for setup (an AI model download of about 2.5 GB)
- **On Windows:** "Windows: planned. Tell us on GitHub if you need it."

### 10. FAQ

Use an accordion. Answer each question in two or three sentences.

1. **Does any data leave my laptop?** The privacy promise, word for word.
2. **Does it work without internet?** Yes, once set up. The internet is needed only once, for the download.
3. **What if Tally misreads a receipt?** You correct the value and the checks re-run. If a VAT amount doesn't add up, the receipt is always flagged, so a misread amount never passes silently.
4. **Does the AI decide whether a receipt is valid?** No. The AI only reads the receipt. Code applies the BIR rules, and you approve.
5. **Can I overrule a Finding?** Yes: dismiss it with a reason. It stays on record as dismissed.
6. **What computer do I need?** A Mac with Apple Silicon and 8 GB RAM. Windows is planned.
7. **What does it cost?** Tally is free while it's in its pilot.

### 11. Final CTA: download

**Purpose:** the conversion. The page ends on the same action as the nav and the hero.

- **Headline** (draft): "Try Tally on your next Liquidation."
- **One line:** install it, set it up once, check the first pile of receipts offline.
- **Button:** **Download for Mac**, with the requirements in one line under it ("Mac with Apple Silicon, 8 GB RAM. Windows is planned.").
- No form, no email capture, no account. Those live in the app.

### 12. Footer

- Tally · "Every receipt checked against BIR rules, on your own laptop."
- A contact email, plus links to the sections
- "Made in the Philippines"
