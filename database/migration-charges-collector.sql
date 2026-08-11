-- Destinação de cobrança por parcela (quem fatura/cobra)
ALTER TABLE charges
  ADD COLUMN collector ENUM('assessoria','seller') NOT NULL DEFAULT 'assessoria'
  AFTER payment_method;

CREATE INDEX idx_charges_collector ON charges (collector);
