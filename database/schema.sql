-- =========================================================
-- MVP Sistema Haras / Assessoria Ariane
-- Banco: u179630068_mvp_ariane
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS charges;
DROP TABLE IF EXISTS contract_signatures;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS animal_genealogy;
DROP TABLE IF EXISTS animal_owners;
DROP TABLE IF EXISTS animals;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS clients;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE clients (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  document_type   ENUM('CPF','CNPJ') NOT NULL DEFAULT 'CPF',
  document        VARCHAR(20) NULL,
  rg              VARCHAR(40) NULL,
  rg_issuer       VARCHAR(80) NULL,
  birth_date      DATE NULL,
  nickname        VARCHAR(120) NULL,
  marital_status  VARCHAR(40) NULL,
  profession      VARCHAR(120) NULL,
  mother_name     VARCHAR(200) NULL,
  father_name     VARCHAR(200) NULL,
  email           VARCHAR(150) NULL,
  phone           VARCHAR(30) NULL,
  whatsapp        VARCHAR(30) NULL,
  city            VARCHAR(100) NULL,
  state           CHAR(2) NULL,
  address         VARCHAR(255) NULL,
  address_number  VARCHAR(20) NULL,
  zip_code        VARCHAR(12) NULL,
  country         VARCHAR(60) NULL DEFAULT 'Brasil',
  notes           TEXT NULL,
  relationship_notes TEXT NULL,
  problems_notes  TEXT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  is_seller       TINYINT(1) NOT NULL DEFAULT 0,
  is_buyer        TINYINT(1) NOT NULL DEFAULT 1,
  is_assessor     TINYINT(1) NOT NULL DEFAULT 0,
  is_witness      TINYINT(1) NOT NULL DEFAULT 0,
  is_avalista     TINYINT(1) NOT NULL DEFAULT 0,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_clients_document (document),
  INDEX idx_clients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL,
  email         VARCHAR(150) NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  avatar_url    VARCHAR(500) NULL,
  role          ENUM('root','admin','user','cliente') NOT NULL DEFAULT 'user',
  client_id     BIGINT UNSIGNED NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_client (client_id),
  CONSTRAINT fk_users_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE clients
  ADD CONSTRAINT fk_clients_created_by
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE client_documents (
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

CREATE TABLE client_properties (
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

CREATE TABLE client_bank_accounts (
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

CREATE TABLE client_contacts (
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

CREATE TABLE animals (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  registration_no   VARCHAR(80) NULL,
  chip_no           VARCHAR(50) NULL,
  sex               ENUM('M','F','C') NULL,
  breed             VARCHAR(80) NULL,
  association       ENUM('ABCCMM','ABQM','OUTRA','NENHUMA') NOT NULL DEFAULT 'NENHUMA',
  birth_date        DATE NULL,
  color             VARCHAR(80) NULL,
  resenha           TEXT NULL,
  status            ENUM('ativo','vendido','falecido','transferido') NOT NULL DEFAULT 'ativo',
  ownership_type    ENUM('unico','condominio') NOT NULL DEFAULT 'unico',
  notes             TEXT NULL,
  photo_url         VARCHAR(500) NULL,
  created_by        BIGINT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_animals_chip (chip_no),
  INDEX idx_animals_name (name),
  INDEX idx_animals_registration (registration_no),
  CONSTRAINT fk_animals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE animal_owners (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  animal_id   BIGINT UNSIGNED NOT NULL,
  client_id   BIGINT UNSIGNED NOT NULL,
  share_pct   DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  is_primary  TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_animal_client (animal_id, client_id),
  CONSTRAINT fk_ao_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  CONSTRAINT fk_ao_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE animal_genealogy (
  animal_id   BIGINT UNSIGNED PRIMARY KEY,
  sire_id     BIGINT UNSIGNED NULL,
  dam_id      BIGINT UNSIGNED NULL,
  sire_name   VARCHAR(150) NULL,
  dam_name    VARCHAR(150) NULL,
  CONSTRAINT fk_gen_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  CONSTRAINT fk_gen_sire FOREIGN KEY (sire_id) REFERENCES animals(id) ON DELETE SET NULL,
  CONSTRAINT fk_gen_dam FOREIGN KEY (dam_id) REFERENCES animals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE catalogs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind       ENUM('breed','sale_type','animal_category','share_quota') NOT NULL,
  name       VARCHAR(120) NOT NULL,
  code       VARCHAR(40) NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_catalog_kind_name (kind, name),
  INDEX idx_catalog_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contracts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  animal_id       BIGINT UNSIGNED NOT NULL,
  sale_type       VARCHAR(40) NOT NULL DEFAULT 'inteiro',
  share_pct       DECIMAL(5,2) NULL,
  seller_id       BIGINT UNSIGNED NOT NULL,
  buyer_id        BIGINT UNSIGNED NOT NULL,
  assessor_id     BIGINT UNSIGNED NULL,
  auction_id      BIGINT UNSIGNED NULL,
  lot_id          BIGINT UNSIGNED NULL,
  template_id     BIGINT UNSIGNED NULL,
  verso_title     VARCHAR(255) NULL,
  verso_body      MEDIUMTEXT NULL,
  contract_number VARCHAR(40) NULL,
  lot_label       VARCHAR(40) NULL,
  animal_category VARCHAR(80) NULL,
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 1,
  commission_total_pct  DECIMAL(5,2) NULL,
  commission_buyer_pct  DECIMAL(5,2) NULL,
  commission_seller_pct DECIMAL(5,2) NULL,
  witness1_id     BIGINT UNSIGNED NULL,
  witness2_id     BIGINT UNSIGNED NULL,
  via_label       VARCHAR(80) NULL DEFAULT 'VIA - VENDEDOR / CONTRATO',
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
  INDEX idx_contracts_auction (auction_id),
  INDEX idx_contracts_lot (lot_id),
  INDEX idx_contracts_template (template_id),
  INDEX idx_contracts_number (contract_number),
  CONSTRAINT fk_contracts_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_seller FOREIGN KEY (seller_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_buyer FOREIGN KEY (buyer_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_assessor FOREIGN KEY (assessor_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_contracts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_contracts_witness1 FOREIGN KEY (witness1_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_contracts_witness2 FOREIGN KEY (witness2_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_templates (
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

ALTER TABLE contracts
  ADD CONSTRAINT fk_contracts_template FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE SET NULL;

CREATE TABLE contract_signatures (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contract_id   BIGINT UNSIGNED NOT NULL,
  party_role    ENUM('seller','buyer','assessor','witness1','witness2') NOT NULL,
  client_id     BIGINT UNSIGNED NOT NULL,
  signer_name   VARCHAR(200) NOT NULL,
  signed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip            VARCHAR(45) NULL,
  user_agent    VARCHAR(500) NULL,
  UNIQUE KEY uk_contract_party (contract_id, party_role),
  CONSTRAINT fk_csig_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT fk_csig_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE charges (
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

CREATE TABLE auctions (
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

CREATE TABLE auction_lots (
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
  CONSTRAINT fk_lots_seller FOREIGN KEY (seller_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_lots_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contract_payout_rules (
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

CREATE TABLE payouts (
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

-- Root: marcus.lopes / *.Admin14!
INSERT INTO users (username, email, password_hash, name, role, active)
VALUES (
  'marcus.lopes',
  'marcus@arianeandradeassessoria.app.br',
  '$2a$12$ZJlL4k1TpvAWzoLPF/nVauaX10aHRCkEXATi6mX885lUUi4ev910q',
  'Marcus Lopes',
  'root',
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = 'root',
  active = 1;
