-- Leilões, lotes, vínculo na venda e repasses
-- Execute no phpMyAdmin (banco do sistema)

CREATE TABLE IF NOT EXISTS auctions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  auction_date    DATE NULL,
  location        VARCHAR(255) NULL,
  organizer       VARCHAR(200) NULL,
  status          ENUM('rascunho','agendado','em_andamento','encerrado','cancelado') NOT NULL DEFAULT 'rascunho',
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auctions_status (status),
  INDEX idx_auctions_date (auction_date),
  CONSTRAINT fk_auctions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auction_lots (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_id      BIGINT UNSIGNED NOT NULL,
  animal_id       BIGINT UNSIGNED NOT NULL,
  lot_number      VARCHAR(40) NULL,
  seller_id       BIGINT UNSIGNED NOT NULL,
  min_price       DECIMAL(12,2) NULL,
  conditions_text TEXT NULL,
  status          ENUM('disponivel','arrematado','retirado') NOT NULL DEFAULT 'disponivel',
  contract_id     BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lots_auction (auction_id),
  INDEX idx_lots_animal (animal_id),
  INDEX idx_lots_status (status),
  CONSTRAINT fk_lots_auction FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  CONSTRAINT fk_lots_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT,
  CONSTRAINT fk_lots_seller FOREIGN KEY (seller_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vínculo opcional contrato ← leilão/lote
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND COLUMN_NAME = 'auction_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE contracts ADD COLUMN auction_id BIGINT UNSIGNED NULL AFTER assessor_id, ADD COLUMN lot_id BIGINT UNSIGNED NULL AFTER auction_id, ADD INDEX idx_contracts_auction (auction_id), ADD INDEX idx_contracts_lot (lot_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS contract_payout_rules (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id           BIGINT UNSIGNED NOT NULL,
  beneficiary_role      ENUM('assessoria','seller','assessor','outro') NOT NULL,
  beneficiary_client_id BIGINT UNSIGNED NULL,
  label                 VARCHAR(120) NULL,
  pct                   DECIMAL(5,2) NOT NULL,
  sort_order            INT UNSIGNED NOT NULL DEFAULT 0,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payout_rules_contract (contract_id),
  CONSTRAINT fk_payout_rules_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_rules_client FOREIGN KEY (beneficiary_client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payouts (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id           BIGINT UNSIGNED NOT NULL,
  charge_id             BIGINT UNSIGNED NOT NULL,
  rule_id               BIGINT UNSIGNED NULL,
  installment_no        INT UNSIGNED NOT NULL,
  beneficiary_role      ENUM('assessoria','seller','assessor','outro') NOT NULL,
  beneficiary_client_id BIGINT UNSIGNED NULL,
  label                 VARCHAR(120) NULL,
  pct                   DECIMAL(5,2) NOT NULL,
  amount                DECIMAL(12,2) NOT NULL,
  status                ENUM('aguardando','pendente','pago','cancelado') NOT NULL DEFAULT 'aguardando',
  paid_at               DATETIME NULL,
  notes                 TEXT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payouts_contract (contract_id),
  INDEX idx_payouts_charge (charge_id),
  INDEX idx_payouts_status (status),
  INDEX idx_payouts_beneficiary (beneficiary_client_id),
  CONSTRAINT fk_payouts_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_payouts_charge FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE CASCADE,
  CONSTRAINT fk_payouts_rule FOREIGN KEY (rule_id) REFERENCES contract_payout_rules(id) ON DELETE SET NULL,
  CONSTRAINT fk_payouts_client FOREIGN KEY (beneficiary_client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FK do lote → contrato (depois de contracts ter lot_id)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auction_lots' AND CONSTRAINT_NAME = 'fk_lots_contract'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE auction_lots ADD CONSTRAINT fk_lots_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
