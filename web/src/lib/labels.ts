// Display names, in GLOSSARY.md vocabulary.
import type { BuyerDetailsRule, LiquidationStatus, ReceiptStatus, Severity, Stage } from "./types";

export const RECEIPT_STATUS: Record<ReceiptStatus, string> = {
  ACCEPTED: "Accepted",
  NO_INPUT_VAT: "No input VAT",
  NEEDS_REVIEW: "Needs review",
  REJECT: "Rejected",
};

export const SEVERITY: Record<Severity, string> = {
  REJECT: "Reject",
  NEEDS_REVIEW: "Needs review",
  NO_INPUT_VAT: "No input VAT",
};

export const LIQUIDATION_STATUS: Record<LiquidationStatus, string> = {
  OPEN: "Open",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

export const STAGE: Record<Stage, string> = {
  queued: "Queued",
  ocr: "Reading text",
  extracting: "Extracting fields",
  checking: "Checking BIR rules",
  done: "Done",
  failed: "Failed",
};
export const STAGE_ORDER: Stage[] = ["queued", "ocr", "extracting", "checking", "done"];

export const CHECK: Record<string, string> = {
  DOC_TYPE: "Document type",
  SELLER_TIN: "Seller TIN",
  BUYER_DETAILS: "Buyer details",
  VAT_ARITHMETIC: "VAT arithmetic",
  DUPLICATE: "Duplicate",
  DATE: "Date",
};

export const BUYER_RULE: Record<BuyerDetailsRule, string> = {
  ALL_RECEIPTS: "All receipts",
  AT_1000_AND_ABOVE: "₱1,000 and above",
};

export const EXPENSE_CATEGORY: Record<string, string> = {
  MEALS: "Meals",
  TRANSPORT_FUEL: "Transport and fuel",
  LODGING: "Lodging",
  SUPPLIES: "Supplies",
  OTHER: "Other",
};

export const DOC_TYPE: Record<string, string> = {
  INVOICE: "Invoice",
  OFFICIAL_RECEIPT: "Official Receipt",
  OTHER: "Other (foreign / non-BIR)",
};

export type FieldKind = "text" | "amount" | "date" | "tin" | "enum" | "bool";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: Record<string, string>;
  editable?: boolean;
}

/** Receipt fields shown on the receipt screen, grouped. Editable ones match the API's EDITABLE_FIELDS. */
export const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Seller",
    fields: [
      { key: "seller_name", label: "Name", kind: "text", editable: true },
      { key: "seller_address", label: "Address", kind: "text", editable: false },
      { key: "seller_tin", label: "TIN", kind: "tin", editable: true },
      { key: "seller_branch", label: "Branch code", kind: "text", editable: true },
      { key: "vat_registered", label: "VAT-registered", kind: "bool", editable: true },
    ],
  },
  {
    title: "Document",
    fields: [
      { key: "doc_type", label: "Document type", kind: "enum", options: DOC_TYPE, editable: true },
      { key: "invoice_number", label: "Invoice number", kind: "text", editable: true },
      { key: "date", label: "Date", kind: "date", editable: true },
      { key: "expense_category", label: "Expense Category", kind: "enum", options: EXPENSE_CATEGORY, editable: true },
      { key: "particulars", label: "Particulars", kind: "text", editable: true },
    ],
  },
  {
    title: "Amounts",
    fields: [
      { key: "vatable_sales", label: "VATable sales", kind: "amount", editable: true },
      { key: "vat_amount", label: "VAT", kind: "amount", editable: true },
      { key: "vat_exempt_sales", label: "VAT-exempt sales", kind: "amount", editable: true },
      { key: "zero_rated_sales", label: "Zero-rated sales", kind: "amount", editable: true },
      { key: "total", label: "Total", kind: "amount", editable: true },
      { key: "withholding_tax", label: "Withholding tax", kind: "amount", editable: true },
    ],
  },
  {
    title: "Buyer",
    fields: [
      { key: "buyer_name", label: "Name", kind: "text", editable: true },
      { key: "buyer_tin", label: "TIN", kind: "tin", editable: true },
    ],
  },
];

export function formatTin(v: unknown): string {
  const s = String(v ?? "");
  return /^\d{9}$/.test(s) ? `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}` : s;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
