# Interactive sample review

Type: task (AFK)
Status: open
Blocked by: 03

## Question

Build the Home page centrepiece: the visitor picks one of three real receipts and watches its Findings appear and the Amount to Return update. The secondary CTA "See it check a receipt" scrolls here.

- Receipts: `bayanihan-corp-1.jpg` (accepted), `mercury-drug-226-faded.jpeg` (seller TIN needs review), `or-cebu-2022-multi-finding.jpg` (Official Receipt, several Findings).
- Data comes from the real pipeline output in `api/tests/fixtures/receipts/<stem>/`, copied into `site/` as static JSON. Never invent a Finding the app would not raise.
- Blur the cardholder name and masked card number on the Cebu receipt before it goes on the site.
- Track which receipt is picked (cookieless analytics).
- Works on a phone and with the keyboard; respects reduced motion.
