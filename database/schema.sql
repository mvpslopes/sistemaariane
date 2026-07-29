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
  email           VARCHAR(150) NULL,
  phone           VARCHAR(30) NULL,
  whatsapp        VARCHAR(30) NULL,
  city            VARCHAR(100) NULL,
  state           CHAR(2) NULL,
  address         VARCHAR(255) NULL,
  notes           TEXT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  is_seller       TINYINT(1) NOT NULL DEFAULT 0,
  is_buyer        TINYINT(1) NOT NULL DEFAULT 1,
  is_assessor     TINYINT(1) NOT NULL DEFAULT 0,
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

CREATE TABLE animals (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  registration_no   VARCHAR(80) NULL,
  chip_no           VARCHAR(50) NULL,
  sex               ENUM('M','F') NULL,
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

CREATE TABLE contracts (
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

CREATE TABLE contract_signatures (
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
