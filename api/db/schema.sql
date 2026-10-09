-- Tally schema (SPEC §3). Money columns are INTEGER centavos. Owner: Eric (Simon asks before changing).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS company (
    id                 INTEGER PRIMARY KEY CHECK (id = 1),
    name               TEXT NOT NULL,
    tin                TEXT NOT NULL,              -- 9 digits + branch, digits only
    buyer_details_rule TEXT NOT NULL DEFAULT 'ALL_RECEIPTS'
                       CHECK (buyer_details_rule IN ('ALL_RECEIPTS', 'AT_1000_AND_ABOVE'))
);

CREATE TABLE IF NOT EXISTS employee (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_advance (
    id              INTEGER PRIMARY KEY,
    employee_id     INTEGER NOT NULL REFERENCES employee(id),
    amount          INTEGER NOT NULL CHECK (amount > 0),
    purpose         TEXT NOT NULL,
    released_on     TEXT NOT NULL,                 -- ISO date
    spending_end_on TEXT NOT NULL,                 -- ISO date, inclusive
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (spending_end_on >= released_on)
);

CREATE TABLE IF NOT EXISTS liquidation (
    id              INTEGER PRIMARY KEY,
    cash_advance_id INTEGER NOT NULL UNIQUE REFERENCES cash_advance(id),
    status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'APPROVED', 'RETURNED')),
    return_note     TEXT,
    capture_token   TEXT NOT NULL,
    frozen_totals   TEXT,                          -- JSON, set on APPROVED
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipt (
    id             INTEGER PRIMARY KEY,
    liquidation_id INTEGER NOT NULL REFERENCES liquidation(id) ON DELETE CASCADE,
    stage          TEXT NOT NULL DEFAULT 'queued'
                   CHECK (stage IN ('queued', 'ocr', 'extracting', 'checking', 'done', 'failed')),
    error          TEXT,
    image_path     TEXT NOT NULL,
    image_hash     TEXT NOT NULL,
    rotation       INTEGER NOT NULL DEFAULT 0,
    ocr_text       TEXT,
    extraction     TEXT,                           -- JSON, immutable once written
    derived        TEXT,                           -- JSON, amounts in centavos
    status         TEXT CHECK (status IN ('ACCEPTED', 'NO_INPUT_VAT', 'NEEDS_REVIEW', 'REJECT')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS receipt_liquidation ON receipt(liquidation_id);
CREATE INDEX IF NOT EXISTS receipt_hash ON receipt(image_hash);

CREATE TABLE IF NOT EXISTS correction (
    id         INTEGER PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES receipt(id) ON DELETE CASCADE,
    field      TEXT NOT NULL,
    value      TEXT,                               -- JSON-encoded; amounts in centavos
    previous   TEXT,
    at         TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (receipt_id, field)
);

CREATE TABLE IF NOT EXISTS finding (
    id                     INTEGER PRIMARY KEY,
    receipt_id             INTEGER NOT NULL REFERENCES receipt(id) ON DELETE CASCADE,
    "check"                TEXT NOT NULL,          -- DOC_TYPE | SELLER_TIN | BUYER_DETAILS | VAT_ARITHMETIC | DUPLICATE | DATE
    condition              TEXT NOT NULL,          -- stable key so dismissals survive re-runs
    severity               TEXT NOT NULL CHECK (severity IN ('REJECT', 'NEEDS_REVIEW', 'NO_INPUT_VAT')),
    state                  TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'DISMISSED', 'CONFIRMED')),
    message                TEXT NOT NULL,
    amount_affected        INTEGER,
    related_liquidation_id INTEGER REFERENCES liquidation(id),
    dismissal_reason       TEXT,
    UNIQUE (receipt_id, "check", condition)
);

CREATE TABLE IF NOT EXISTS question (
    id         INTEGER PRIMARY KEY,
    text       TEXT NOT NULL,
    state      TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'answering', 'done')),
    answer     TEXT,                               -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
