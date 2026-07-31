-- Cadastro completo de pessoas: campos extras + documentos, propriedades, contas, contatos
-- Execute no phpMyAdmin após o schema base

-- Campos extras em clients
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'rg');
SET @sql := IF(@c = 0,
  "ALTER TABLE clients
    ADD COLUMN rg VARCHAR(40) NULL AFTER document,
    ADD COLUMN rg_issuer VARCHAR(80) NULL AFTER rg,
    ADD COLUMN birth_date DATE NULL AFTER rg_issuer,
    ADD COLUMN nickname VARCHAR(120) NULL AFTER birth_date,
    ADD COLUMN marital_status VARCHAR(40) NULL AFTER nickname,
    ADD COLUMN profession VARCHAR(120) NULL AFTER marital_status,
    ADD COLUMN mother_name VARCHAR(200) NULL AFTER profession,
    ADD COLUMN father_name VARCHAR(200) NULL AFTER mother_name,
    ADD COLUMN zip_code VARCHAR(12) NULL AFTER address,
    ADD COLUMN country VARCHAR(60) NULL DEFAULT 'Brasil' AFTER zip_code,
    ADD COLUMN relationship_notes TEXT NULL AFTER notes,
    ADD COLUMN problems_notes TEXT NULL AFTER relationship_notes",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS client_documents (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id     BIGINT UNSIGNED NOT NULL,
  doc_type      ENUM('rg','identidade','cnh','comprovante_residencia','selfie','outro') NOT NULL DEFAULT 'outro',
  file_url      VARCHAR(500) NOT NULL,
  file_name     VARCHAR(255) NULL,
  notes         VARCHAR(255) NULL,
  uploaded_by   BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cdoc_client (client_id),
  CONSTRAINT fk_cdoc_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdoc_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_properties (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id         BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(200) NOT NULL,
  cnpj              VARCHAR(20) NULL,
  state_registration VARCHAR(40) NULL,
  zip_code          VARCHAR(12) NULL,
  state             CHAR(2) NULL,
  city              VARCHAR(100) NULL,
  address           VARCHAR(255) NULL,
  phone             VARCHAR(30) NULL,
  property_type     VARCHAR(80) NULL,
  is_primary        TINYINT(1) NOT NULL DEFAULT 0,
  manager_name      VARCHAR(150) NULL,
  manager_phone     VARCHAR(30) NULL,
  manager_email     VARCHAR(150) NULL,
  notes             TEXT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cprop_client (client_id),
  CONSTRAINT fk_cprop_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_bank_accounts (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id         BIGINT UNSIGNED NOT NULL,
  account_type      ENUM('corrente','poupanca','pagamento','outro') NOT NULL DEFAULT 'corrente',
  bank_name         VARCHAR(120) NOT NULL,
  agency            VARCHAR(30) NULL,
  account_number    VARCHAR(40) NULL,
  holder_name       VARCHAR(200) NULL,
  holder_document   VARCHAR(20) NULL,
  is_primary        TINYINT(1) NOT NULL DEFAULT 0,
  notes             VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cbank_client (client_id),
  CONSTRAINT fk_cbank_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_contacts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id     BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150) NOT NULL,
  role_label    VARCHAR(80) NULL,
  phone         VARCHAR(30) NULL,
  email         VARCHAR(150) NULL,
  notes         VARCHAR(255) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ccont_client (client_id),
  CONSTRAINT fk_ccont_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
