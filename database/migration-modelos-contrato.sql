-- Modelos de contrato (versos) + campos da nota de leilão
-- Execute no phpMyAdmin após migration-leiloes-repasses.sql

CREATE TABLE IF NOT EXISTS contract_templates (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(60) NULL,
  title           VARCHAR(255) NOT NULL DEFAULT 'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO',
  body_text       MEDIUMTEXT NOT NULL,
  is_default      TINYINT(1) NOT NULL DEFAULT 0,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_templates_code (code),
  INDEX idx_templates_active (active),
  CONSTRAINT fk_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campos extras no contrato (frente da nota)
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND COLUMN_NAME = 'template_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE contracts
     ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER lot_id,
     ADD COLUMN contract_number VARCHAR(40) NULL AFTER template_id,
     ADD COLUMN lot_label VARCHAR(40) NULL AFTER contract_number,
     ADD COLUMN animal_category VARCHAR(80) NULL AFTER lot_label,
     ADD COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1 AFTER animal_category,
     ADD COLUMN commission_total_pct DECIMAL(5,2) NULL AFTER quantity,
     ADD COLUMN commission_buyer_pct DECIMAL(5,2) NULL AFTER commission_total_pct,
     ADD COLUMN commission_seller_pct DECIMAL(5,2) NULL AFTER commission_buyer_pct,
     ADD COLUMN witness1_id BIGINT UNSIGNED NULL AFTER commission_seller_pct,
     ADD COLUMN witness2_id BIGINT UNSIGNED NULL AFTER witness1_id,
     ADD COLUMN via_label VARCHAR(80) NULL DEFAULT ''VIA - VENDEDOR / CONTRATO'' AFTER witness2_id,
     ADD INDEX idx_contracts_template (template_id),
     ADD INDEX idx_contracts_number (contract_number)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND CONSTRAINT_NAME = 'fk_contracts_template');
SET @sql := IF(@fk = 0,
  'ALTER TABLE contracts ADD CONSTRAINT fk_contracts_template FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND CONSTRAINT_NAME = 'fk_contracts_witness1');
SET @sql := IF(@fk = 0,
  'ALTER TABLE contracts
     ADD CONSTRAINT fk_contracts_witness1 FOREIGN KEY (witness1_id) REFERENCES clients(id) ON DELETE SET NULL,
     ADD CONSTRAINT fk_contracts_witness2 FOREIGN KEY (witness2_id) REFERENCES clients(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ampliar papéis de assinatura (testemunhas)
ALTER TABLE contract_signatures
  MODIFY COLUMN party_role ENUM('seller','buyer','assessor','witness1','witness2') NOT NULL;
