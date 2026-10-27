CREATE UNIQUE INDEX one_active_session_per_project ON sessions(project_id) WHERE status='active';
CREATE UNIQUE INDEX one_invoice_per_session ON invoices(session_id) WHERE session_id IS NOT NULL;
