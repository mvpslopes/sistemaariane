-- Financeiro por leilão — despesas do evento (Fase 2)
-- Rodar no phpMyAdmin se ainda não aplicada.

CREATE TABLE IF NOT EXISTS auction_expenses (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_id      BIGINT UNSIGNED NOT NULL,
  category        ENUM('locacao','equipe','marketing','leiloeiro','transporte','outros') NOT NULL DEFAULT 'outros',
  description     VARCHAR(255) NULL,
  amount          DECIMAL(12,2) NOT NULL,
  expense_date    DATE NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ae_auction (auction_id),
  INDEX idx_ae_date (expense_date),
  CONSTRAINT fk_ae_auction FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ae_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
