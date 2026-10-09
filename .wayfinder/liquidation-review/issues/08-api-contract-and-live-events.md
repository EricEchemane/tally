# API contract and live events

Type: prototype (HITL)
Status: open
Blocked by: 05, 06

## Question

What is the FastAPI ↔ Next.js contract? It covers:
- resources and endpoints for Cash Advances, Receipts (upload from the phone), Findings, Liquidation summary, exports and questions
- the WebSocket events that make the dashboard fill in live while a Receipt goes through OCR → extraction → checks
- how the phone capture page is served over the LAN

Prototype as an OpenAPI sketch plus event list (stub endpoints are fine) to react to. This contract is what the teammate builds the UI against and what the backend tests protect.

## Comments
