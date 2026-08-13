-- Fase 3: Recebíveis (base), Financeiro empresa (agregações) e SaaS por haras
-- Rodar no phpMyAdmin se ainda não aplicada.

ALTER TABLE clients
  ADD COLUMN subscription_type ENUM('assessoria','avulso') NOT NULL DEFAULT 'assessoria' AFTER active,
  ADD COLUMN subscription_suspended TINYINT(1) NOT NULL DEFAULT 0 AFTER subscription_type,
  ADD COLUMN adhesion_fee DECIMAL(12,2) NULL AFTER subscription_suspended,
  ADD COLUMN monthly_fee DECIMAL(12,2) NULL AFTER adhesion_fee,
  ADD COLUMN adhesion_paid_at DATE NULL AFTER monthly_fee;

CREATE TABLE IF NOT EXISTS client_modules (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id       BIGINT UNSIGNED NOT NULL,
  module_code     ENUM('plantel','reproducao','sanitario','contratos','leiloes') NOT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  monthly_fee     DECIMAL(12,2) NULL,
  activated_at    DATE NULL,
  notes           VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cm_client_module (client_id, module_code),
  INDEX idx_cm_active (active),
  CONSTRAINT fk_cm_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
