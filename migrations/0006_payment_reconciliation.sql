CREATE TABLE bank_transactions (
  id TEXT PRIMARY KEY,
  utr TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  transaction_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual_bank_alert',
  status TEXT NOT NULL CHECK (status IN ('matched','unmatched','review')),
  invoice_id TEXT REFERENCES invoices(id),
  imported_by TEXT NOT NULL REFERENCES staff(id),
  imported_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX bank_transactions_date ON bank_transactions(transaction_at DESC);
CREATE INDEX bank_transactions_invoice ON bank_transactions(invoice_id);
