ALTER TABLE bank_transactions ADD COLUMN source_message_id TEXT;
CREATE UNIQUE INDEX bank_transactions_source_message ON bank_transactions(source_message_id) WHERE source_message_id IS NOT NULL;
