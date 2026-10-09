Short version: on your 8GB M1, the pipeline that will hold up in a live demo is OCR first, then a small text model. A model that reads images directly is the backup.

- Reading the photo: Apple's built-in Vision OCR, called from Python via the ocrmac package. It runs in under a second on the Mac's Neural Engine and uses no model memory.
- Structuring the text into fields: one model kept loaded, Qwen3 4B or Qwen2.5 3B in Ollama. Ollama can force the output to match a JSON Schema, which keeps the extracted fields in a fixed shape.
- Storage and questions: results go into SQLite. Questions are answered by the same model turning them into SQL, with ready-made queries as a backup in case it's unreliable on stage.
- Checks: plain code verifies that line items add up to the total, VAT is 12%, and the TIN format is valid. These catch the model's mistakes and are useful features on their own.
- Phone: use it only for taking photos and as the screen. It opens a page served by the Mac over Wi-Fi or a hotspot, so no internet is needed. A plain <input capture> file field opens the camera without needing HTTPS. Skip running a model on the phone.
- Voice (optional): whisper.cpp on the Mac. The browser's speech API isn't reliably offline.
- Memory: a vision model and a chat model won't both fit in 8GB at a useful size, so keep just one model loaded.
- Caveat: none of the latency numbers were measured on an 8GB M1. I'll add a task to the map to test on your real machine early.

The second research agent (Philippine receipts and BIR rules) has reported back. I'm still waiting on your Round 2 answers. Here's what it found and how it affects the choice of user.

Main finding: freelancers are a weaker target than they look. Most freelancers use the 8% flat tax, and on that option expenses can't be deducted, so their expense receipts barely affect what they pay. The documents that matter to them are the invoices they issue and the Form 2307s clients send them, which often arrive late or with mistakes.

---

The sharpest pain is input-VAT and liquidation receipts, handled by bookkeepers and company admins:
- Real money is lost. Input VAT gets disallowed when a receipt is faded, still says "Official Receipt" instead of "Invoice", is missing the supplier's TIN or branch code, or is stamped "NOT VALID FOR CLAIM OF INPUT TAX".
- The rules changed recently. The EOPT Act (2024) made "Invoice" the only valid proof of sale, which confused a lot of people. For ₱1,000 or more, the buyer's name and TIN must be on the invoice.
- Bookkeepers type every receipt in by hand each month (TIN, VATable amount, input VAT, and so on) to build the SLSP (the summary list of purchases filed with the BIR).
- Every competitor is cloud-based (Taxumo, JuanTax, Xero). None checks whether a receipt is BIR-valid at the moment it's scanned. For an accounting firm holding clients' TINs, keeping data on the device helps with the Data Privacy Act.
- Mandatory e-invoicing doesn't start until Dec 31, 2026. Until then there's a messy mix of paper invoices and POS tapes, which is good for a scanner.

---

So one candidate concept is:

▎ Snap a receipt with Wi-Fi off and get "✅ likely input-VAT claimable" or "⚠️ 3 issues" in seconds, then export the rows straight into the SLSP.

The phone takes the photo. The Mac reads the text, pulls out the fields, and runs the checks. You can then ask a question like "how much input VAT did we lose this quarter?" in plain language. Present the result as "likely valid", not a guarantee, because the printer's Authority to Print (ATP) can't be checked offline.
