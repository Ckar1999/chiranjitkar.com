ALTER TABLE clients ADD COLUMN referral_code TEXT;
ALTER TABLE projects ADD COLUMN referrer_client_id TEXT REFERENCES clients(id);
ALTER TABLE inquiries ADD COLUMN referral_code TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX clients_referral_code ON clients(referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_client_id TEXT NOT NULL REFERENCES clients(id),
  referred_email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  referred_project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
  package_invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(id),
  package_amount INTEGER NOT NULL CHECK (package_amount > 0),
  reward_amount INTEGER NOT NULL CHECK (reward_amount >= 0),
  reward_percent INTEGER NOT NULL DEFAULT 5 CHECK (reward_percent = 5),
  created_at TEXT NOT NULL
);

CREATE TABLE wallet_transactions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  reward_id TEXT UNIQUE REFERENCES referral_rewards(id),
  invoice_id TEXT REFERENCES invoices(id),
  project_id TEXT REFERENCES projects(id),
  kind TEXT NOT NULL CHECK (kind IN ('referral_reward','booking_redemption')),
  amount INTEGER NOT NULL CHECK (amount != 0),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX wallet_one_redemption_per_request ON wallet_transactions(invoice_id,kind) WHERE kind='booking_redemption' AND invoice_id IS NOT NULL;
CREATE INDEX wallet_transactions_client_date ON wallet_transactions(client_id,created_at DESC);
