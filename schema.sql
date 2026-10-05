-- Controle Financeiro Pessoal — proposta de esquema v1.
-- Ativar foreign_keys em CADA conexão. Valores monetários em centavos.
-- Datas: YYYY-MM-DD; competências: YYYY-MM; timestamps: UTC.
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
    color TEXT NOT NULL DEFAULT '#6366F1',
    archived_at TEXT
);

CREATE TABLE monthly_reserves (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
    month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(month, 6, 2) BETWEEN '01' AND '12'),
    budget_cents INTEGER NOT NULL CHECK (budget_cents >= 0),
    UNIQUE (name, month)
);

CREATE TABLE recurring_bills (
    id INTEGER PRIMARY KEY,
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    starts_on TEXT NOT NULL CHECK (date(starts_on, '+0 days') IS NOT NULL AND date(starts_on, '+0 days') = starts_on),
    ends_on TEXT CHECK (ends_on IS NULL OR (date(ends_on, '+0 days') IS NOT NULL AND date(ends_on, '+0 days') = ends_on AND ends_on >= starts_on)),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE credit_cards (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
    limit_cents INTEGER NOT NULL CHECK (limit_cents >= 0),
    closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    archived_at TEXT
);

CREATE TABLE invoices (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE RESTRICT,
    month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(month, 6, 2) BETWEEN '01' AND '12'),
    closes_on TEXT NOT NULL CHECK (date(closes_on, '+0 days') IS NOT NULL AND date(closes_on, '+0 days') = closes_on),
    due_on TEXT NOT NULL CHECK (date(due_on, '+0 days') IS NOT NULL AND date(due_on, '+0 days') = due_on AND due_on > closes_on),
    closed_at TEXT,
    UNIQUE (card_id, month)
);

CREATE TABLE card_purchases (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    purchased_on TEXT NOT NULL CHECK (date(purchased_on, '+0 days') IS NOT NULL AND date(purchased_on, '+0 days') = purchased_on),
    total_cents INTEGER NOT NULL CHECK (total_cents > 0),
    installment_count INTEGER NOT NULL CHECK (installment_count >= 1 AND installment_count <= total_cents),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE installments (
    id INTEGER PRIMARY KEY,
    purchase_id INTEGER NOT NULL REFERENCES card_purchases(id) ON DELETE RESTRICT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    reserve_id INTEGER REFERENCES monthly_reserves(id) ON DELETE RESTRICT,
    installment_number INTEGER NOT NULL CHECK (installment_number >= 1),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    UNIQUE (purchase_id, installment_number),
    UNIQUE (purchase_id, invoice_id)
);

-- Receitas/despesas diretas e pagamentos de fatura (saídas de caixa).
-- paid_on NULL = pendente. A data de competência é independente da quitação.
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'invoice_payment')),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    occurred_on TEXT NOT NULL CHECK (date(occurred_on, '+0 days') IS NOT NULL AND date(occurred_on, '+0 days') = occurred_on),
    due_on TEXT NOT NULL CHECK (date(due_on, '+0 days') IS NOT NULL AND date(due_on, '+0 days') = due_on),
    paid_on TEXT CHECK (paid_on IS NULL OR (date(paid_on, '+0 days') IS NOT NULL AND date(paid_on, '+0 days') = paid_on)),
    category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
    reserve_id INTEGER REFERENCES monthly_reserves(id) ON DELETE RESTRICT,
    recurring_bill_id INTEGER REFERENCES recurring_bills(id) ON DELETE RESTRICT,
    recurrence_month TEXT CHECK (recurrence_month IS NULL OR (recurrence_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(recurrence_month, 6, 2) BETWEEN '01' AND '12')),
    invoice_id INTEGER UNIQUE REFERENCES invoices(id) ON DELETE RESTRICT,
    canceled_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((kind = 'invoice_payment' AND invoice_id IS NOT NULL AND category_id IS NULL AND reserve_id IS NULL AND recurring_bill_id IS NULL AND paid_on IS NOT NULL AND canceled_at IS NULL)
        OR (kind IN ('income', 'expense') AND invoice_id IS NULL AND category_id IS NOT NULL)),
    CHECK (reserve_id IS NULL OR kind = 'expense'),
    CHECK ((recurring_bill_id IS NULL AND recurrence_month IS NULL)
        OR (recurring_bill_id IS NOT NULL AND recurrence_month IS NOT NULL AND kind = 'expense' AND recurrence_month = substr(occurred_on, 1, 7))),
    UNIQUE (recurring_bill_id, recurrence_month)
);

CREATE INDEX idx_transactions_month ON transactions(occurred_on, kind);
CREATE INDEX idx_transactions_pending ON transactions(due_on) WHERE paid_on IS NULL AND canceled_at IS NULL;
CREATE INDEX idx_transactions_reserve ON transactions(reserve_id);
CREATE INDEX idx_installments_invoice ON installments(invoice_id);
CREATE INDEX idx_installments_reserve ON installments(reserve_id);
CREATE INDEX idx_invoices_due ON invoices(due_on);
CREATE INDEX idx_purchases_card ON card_purchases(card_id);

CREATE VIEW invoice_summary AS
SELECT i.*, COALESCE(a.total_cents, 0) AS total_cents,
       CASE WHEN t.id IS NOT NULL THEN 'paid'
            WHEN i.closed_at IS NOT NULL THEN 'closed' ELSE 'open' END AS status,
       t.paid_on, t.id AS payment_transaction_id
FROM invoices i
LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS total_cents FROM installments GROUP BY invoice_id) a ON a.invoice_id = i.id
LEFT JOIN transactions t ON t.invoice_id = i.id;

CREATE VIEW card_limit_summary AS
SELECT c.*, COALESCE(a.committed_cents, 0) AS committed_cents,
       c.limit_cents - COALESCE(a.committed_cents, 0) AS available_cents
FROM credit_cards c
LEFT JOIN (
    SELECT card_id, SUM(total_cents) AS committed_cents
    FROM invoice_summary WHERE status <> 'paid' GROUP BY card_id
) a ON a.card_id = c.id;

CREATE VIEW reserve_summary AS
SELECT r.*, COALESCE(a.spent_cents, 0) AS spent_cents,
       r.budget_cents - COALESCE(a.spent_cents, 0) AS remaining_cents
FROM monthly_reserves r
LEFT JOIN (
    SELECT reserve_id, SUM(amount_cents) AS spent_cents FROM (
        SELECT reserve_id, amount_cents FROM transactions WHERE kind = 'expense' AND canceled_at IS NULL
        UNION ALL
        SELECT reserve_id, amount_cents FROM installments
    ) GROUP BY reserve_id
) a ON a.reserve_id = r.id;

COMMIT;
