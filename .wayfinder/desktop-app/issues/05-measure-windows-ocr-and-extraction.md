# Measure OCR and extraction on Windows

Type: task (HITL)
Status: open
Assignee: Eric
Blocked by: 01, 03

## Question

On Simon's Windows machine, how accurate and how fast is the shortlisted OCR engine (or engines) followed by `qwen3:4b` on the sample receipts, compared with the M1 numbers (90% of fields, ~15 s per receipt)?

Reuse the M1 benchmark scripts in [research/03-m1-bench](../../liquidation-review/research/03-m1-bench) and the ground truth in `api/tests/expected.py`. Record the machine's CPU, RAM and GPU. Simon runs it; the agent prepares the script and a checklist.

## Progress

- **2026-10-09 (Eric):** the script and Simon's checklist are in [research/05-windows-bench](../research/05-windows-bench/README.md). On the M1, RapidOCR + qwen3:4b scores **88%** (203/231) against Apple Vision's **92%**. Missed seller TINs and wrong amounts are all flagged; the only silent errors are invoice numbers (dates, MINs, label words), which a `derive` fix can catch, and one US date with day and month swapped. RapidOCR's accuracy carries over to Windows. Still waiting on Simon: Windows speed (OCR and model on CPU), the Windows built-in OCR engine, the integrated-GPU setting and the install notes.
