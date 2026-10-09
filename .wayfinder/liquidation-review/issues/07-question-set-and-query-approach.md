# Question set and query approach

Type: grilling (HITL)
Status: resolved
Blocked by: 05

## Question

Which natural-language questions must the Reviewer be able to ask in the demo (for example "which Cash Advances are still open after 30 days?" or "how much input VAT did we lose this month?")? How are they answered:
- canned parameterized queries chosen by the local LLM (intent classification)
- free text-to-SQL with a read-only guard
- or a mix

How does the answer get phrased and shown?

## Answer

**Supported questions (7):**

| # | Question | Slots |
|---|---|---|
| 1 | Open (unliquidated) Cash Advances older than N days | days |
| 2 | Input VAT lost in a period, and why (non-creditable + rejected VAT, grouped by Finding type) | period |
| 3 | Amount to Return per Employee | employee? |
| 4 | Spend by Expense Category in a period | category?, period |
| 5 | Suppliers with the most invalid receipts | period? |
| 6 | Receipts submitted twice (cross-Liquidation duplicates) | period? |
| 7 | What still needs my review (open NEEDS_REVIEW) | (none) |

- **Demo:** questions 2, 4 and 6, plus one Taglish question.
- **Anything else:** "I can't answer that yet", plus the list of supported questions.

**Approach: the LLM interprets, code computes.**
1. One qwen3:4b call returns `{question_id, employee, expense_category, period, days}` as a JSON Schema enum or nullable fields (about 30 output tokens). The prompt has 2–3 English and Taglish examples.
2. `period` is `THIS_MONTH | LAST_MONTH | THIS_QUARTER | MONTH:YYYY-MM | RANGE:start..end`. Code resolves it to dates relative to today; the model never does date arithmetic.
3. Code runs a fixed, parameterized, read-only SQL template per question; each template has a pytest test. The answer sentence comes from a code template in English. **No number in an answer is written by the model.**
4. An ambiguous Employee name gets a clarifying choice between the matches, never a guess.

**Scheduling:** one model on 8GB, so questions jump the queue between receipt extractions. The worst-case wait is one receipt in progress (~15 s).

**Display:** a one-sentence answer, a small table, links into the records (supplier, receipt, Liquidation), and a "how I got this" line (the matched question and the resolved period).

**Not covered:** voice (stays in the map's fog) and free text-to-SQL (rejected as too unreliable on a 4B model for a live demo).

## Comments
- From Receipt extraction schema: queryable fields include `expense_category`, `particulars`, the effective amounts, and the OCR text. There are no line items.
