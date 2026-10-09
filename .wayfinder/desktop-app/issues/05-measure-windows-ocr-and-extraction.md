# Measure OCR and extraction on Windows

Type: task (HITL)
Status: open
Assignee:
Blocked by: 01, 03

## Question

On Simon's Windows machine, how accurate and how fast is the shortlisted OCR engine (or engines) followed by `qwen3:4b` on the sample receipts, compared with the M1 numbers (90% of fields, ~15 s per receipt)?

Reuse the M1 benchmark scripts in [research/03-m1-bench](../../liquidation-review/research/03-m1-bench) and the ground truth in `api/tests/expected.py`. Record the machine's CPU, RAM and GPU. Simon runs it; the agent prepares the script and a checklist.
