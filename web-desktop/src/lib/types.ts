// Mirrors the agreed API contract (.wayfinder/liquidation-review/research/08-api-sketch.md).
// Money is peso numbers; the UI never adds money up — it shows `totals`.

export type BuyerDetailsRule = "ALL_RECEIPTS" | "AT_1000_AND_ABOVE";
export type LiquidationStatus = "OPEN" | "APPROVED" | "RETURNED";
export type ReceiptStatus = "ACCEPTED" | "NO_INPUT_VAT" | "NEEDS_REVIEW" | "REJECT";
export type Stage = "queued" | "ocr" | "extracting" | "checking" | "done" | "failed";
export type Severity = "REJECT" | "NEEDS_REVIEW" | "NO_INPUT_VAT";

export interface Company { name: string; tin: string; buyer_details_rule: BuyerDetailsRule }
export interface Employee {
  id: number; name: string; active: boolean;
  cash_advances?: number; open_liquidations?: number; // only on the Employees list
}

export interface Totals {
  advance: number; valid_spend: number; disallowed: number;
  amount_to_return: number; excess_spend: number; claimable_input_vat: number;
}

export interface CashAdvance {
  id: number; employee: Employee; amount: number; purpose: string;
  released_on: string; spending_end_on: string; archived: boolean;
  liquidation: {
    id: number; status: LiquidationStatus; totals: Totals;
    counts: { receipts: number; processing: number; failed: number; needs_review: number };
  };
}

export interface ReceiptSummary {
  // status is null while processing or while checks are pending (checks_pending) — never show null as a pass.
  id: number; stage: Stage; status: ReceiptStatus | null; checks_pending: boolean; seller_name: string | null;
  date: string | null; total: number | null; thumbnail_url: string; open_findings: number;
}

export interface Liquidation {
  id: number; status: LiquidationStatus; return_note: string | null;
  cash_advance: Omit<CashAdvance, "liquidation">; totals: Totals;
  open_needs_review: number; receipts: ReceiptSummary[];
}

export interface Finding {
  id: number; check: string; condition: string; severity: Severity; state: "OPEN" | "DISMISSED" | "CONFIRMED";
  message: string; amount_affected: number | null;
  related: { liquidation_id: number } | null; dismissal_reason: string | null;
}

export interface Receipt {
  id: number; liquidation_id: number; stage: Stage; status: ReceiptStatus | null; checks_pending: boolean; error: string | null;
  image_url: string; cropped_image_url: string | null; rotation: number; ocr_text: string | null;
  extraction: Record<string, unknown> | null; derived: Record<string, unknown> | null;
  corrections: { field: string; value: unknown; previous: unknown; at: string }[];
  effective: Record<string, unknown> | null; findings: Finding[];
}

export type Answer =
  | { kind: "answer"; sentence: string; table: { columns: string[]; rows: unknown[][] };
      links: { label: string; href: string }[];
      how: { question_id: number; question: string; period: { from: string; to: string } | null; slots?: Record<string, unknown> } }
  | { kind: "clarify"; sentence: string; choices: { label: string; text: string }[] }
  | { kind: "unsupported"; sentence: string; supported: string[] }   // answers stored before replies existed
  // Pre-written text (greeting, help, thanks, an explanation, or the polite refusal); never model-written.
  | { kind: "reply"; sentence: string; body: string[]; suggestions: string[]; note: string | null };

export interface Question { id: number; text: string; state: "queued" | "answering" | "done"; created_at: string; answer: Answer | null }

export interface Health {
  ollama: "up" | "down" | "fake"; model: string; model_loaded: boolean; fake_pipeline: boolean;
  queue: { length: number; current: { kind: "receipt" | "question"; id: number } | null };
}

// WebSocket events are invalidation hints (SPEC §7).
export type LiveEvent =
  | { event: "receipt.stage"; receipt_id: number; liquidation_id: number; stage: Stage; queue_position: number }
  | { event: "receipt.ocr_done"; receipt_id: number; preview: string }
  | { event: "receipt.updated"; receipt_id: number; liquidation_id: number; status: ReceiptStatus; open_findings: number }
  | { event: "receipt.failed"; receipt_id: number; error: string }
  | { event: "liquidation.updated"; liquidation_id: number; status: LiquidationStatus; totals: Totals }
  | { event: "question.answered"; question_id: number }
  | { event: "company.updated"; buyer_details_rule: BuyerDetailsRule }
  | { event: "queue.updated"; length: number; current: { kind: "receipt" | "question"; id: number } | null };

// The Overview page (api/overview.py). Peso numbers computed by the server.
export type OverviewPeriod = "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "ALL";
export interface Overview {
  period: OverviewPeriod; period_label: string; receipts: number; needs_review: number;
  spend: number; valid_spend: number; disallowed: number; input_vat_lost: number;
  outstanding: {
    open: number; amount: number; overdue_days: number;
    overdue: { liquidation_id: number; employee: string; purpose: string; released_on: string; days: number; amount: number }[];
  };
  disallowed_reasons: { reason: string; receipts: number; amount: number; receipt_ids: number[] }[];
  by_category: { category: string; amount: number }[];
  by_employee: { employee: string; valid_spend: number; disallowed: number }[];
}
