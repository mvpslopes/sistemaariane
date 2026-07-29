-- =========================================================
-- Migration: Contratos, cobranças e papéis de clientes
-- Banco existente: u179630068_mvp_ariane
-- Execute no phpMyAdmin (uma vez) — NÃO dropa tabelas
-- =========================================================

SET NAMES utf8mb4;

-- Papéis no cadastro de clientes (uma pessoa pode ter vários)
ALTER TABLE clients
  ADD COLUMN is_seller   TINYINT(1) NOT NULL DEFAULT 0 AFTER active,
  ADD COLUMN is_buyer    TINYINT(1) NOT NULL DEFAULT 1 AFTER is_seller,
  ADD COLUMN is_assessor TINYINT(1) NOT NULL DEFAULT 0 AFTER is_buyer;

-- Clientes já existentes = compradores por padrão
UPDATE clients SET is_buyer = 1 WHERE is_buyer = 0 AND is_seller = 0 AND is_assessor = 0;

CREATE TABLE IF NOT EXISTS contracts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  animal_id       BIGINT UNSIGNED NOT NULL,
  sale_type       ENUM('inteiro','fracao','condominio') NOT NULL DEFAULT 'inteiro',
  share_pct       DECIMAL(5,2) NULL,
  seller_id       BIGINT UNSIGNED NOT NULL,
  buyer_id        BIGINT UNSIGNED NOT NULL,
  assessor_id     BIGINT UNSIGNED NULL,
  total_amount    DECIMAL(12,2) NOT NULL,
  payment_method  ENUM('pix','boleto','transferencia','outro') NOT NULL DEFAULT 'boleto',
  installments    INT UNSIGNED NOT NULL DEFAULT 1,
  first_due_date  DATE NOT NULL,
  status          ENUM('rascunho','aguardando_assinatura','ativo','concluido','cancelado') NOT NULL DEFAULT 'aguardando_assinatura',
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contracts_animal (animal_id),
  INDEX idx_contracts_buyer (buyer_id),
  INDEX idx_contracts_seller (seller_id),
  INDEX idx_contracts_status (status),
  CONSTRAINT fk_contracts_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_seller FOREIGN KEY (seller_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_buyer FOREIGN KEY (buyer_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_assessor FOREIGN KEY (assessor_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_contracts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_signatures (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id   BIGINT UNSIGNED NOT NULL,
  party_role    ENUM('seller','buyer','assessor') NOT NULL,
  client_id     BIGINT UNSIGNED NOT NULL,
  signer_name   VARCHAR(200) NOT NULL,
  signed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip            VARCHAR(45) NULL,
  user_agent    VARCHAR(500) NULL,
  UNIQUE KEY uk_contract_party (contract_id, party_role),
  CONSTRAINT fk_csig_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_csig_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS charges (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id      BIGINT UNSIGNED NOT NULL,
  client_id        BIGINT UNSIGNED NOT NULL,
  installment_no   INT UNSIGNED NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,
  due_date         DATE NOT NULL,
  payment_method   ENUM('pix','boleto','transferencia','outro') NOT NULL DEFAULT 'boleto',
  status           ENUM('pendente','pago','atrasado','cancelado') NOT NULL DEFAULT 'pendente',
  paid_at          DATETIME NULL,
  external_ref     VARCHAR(120) NULL,
  notes            TEXT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_charge_installment (contract_id, installment_no),
  INDEX idx_charges_client (client_id),
  INDEX idx_charges_status (status),
  INDEX idx_charges_due (due_date),
  CONSTRAINT fk_charges_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_charges_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
