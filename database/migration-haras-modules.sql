-- Módulos de gestão de haras: veterinário, estoque, hospedagem e financeiro da propriedade.

CREATE TABLE IF NOT EXISTS haras_vet_records (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  animal_id       BIGINT UNSIGNED NOT NULL,
  record_type     ENUM('vacina','vermifugo','exame','tratamento','outro') NOT NULL DEFAULT 'vacina',
  title           VARCHAR(180) NOT NULL,
  product         VARCHAR(180) NULL,
  record_date     DATE NOT NULL,
  next_due_date   DATE NULL,
  veterinarian    VARCHAR(150) NULL,
  result_notes    VARCHAR(500) NULL,
  cost            DECIMAL(12,2) NULL,
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_haras_vet_animal (animal_id),
  INDEX idx_haras_vet_date (record_date),
  INDEX idx_haras_vet_type (record_type),
  CONSTRAINT fk_haras_vet_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  CONSTRAINT fk_haras_vet_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS haras_stock_items (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(180) NOT NULL,
  category        ENUM('medicamento','insumo','racao','material','outro') NOT NULL DEFAULT 'insumo',
  unit            VARCHAR(20) NOT NULL DEFAULT 'un',
  quantity        DECIMAL(12,3) NOT NULL DEFAULT 0,
  min_quantity    DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_cost       DECIMAL(12,2) NULL,
  location        VARCHAR(120) NULL,
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_haras_stock_name (name),
  INDEX idx_haras_stock_cat (category),
  CONSTRAINT fk_haras_stock_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS haras_stock_moves (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id         BIGINT UNSIGNED NOT NULL,
  move_type       ENUM('entrada','saida','ajuste') NOT NULL,
  quantity        DECIMAL(12,3) NOT NULL,
  reason          VARCHAR(255) NULL,
  animal_id       BIGINT UNSIGNED NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_haras_moves_item (item_id),
  CONSTRAINT fk_haras_moves_item FOREIGN KEY (item_id) REFERENCES haras_stock_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_haras_moves_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL,
  CONSTRAINT fk_haras_moves_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS haras_stays (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  animal_id       BIGINT UNSIGNED NOT NULL,
  owner_client_id BIGINT UNSIGNED NULL,
  stall           VARCHAR(40) NULL,
  check_in        DATE NOT NULL,
  check_out       DATE NULL,
  daily_rate      DECIMAL(12,2) NOT NULL DEFAULT 0,
  status          ENUM('hospedado','encerrado') NOT NULL DEFAULT 'hospedado',
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_haras_stays_status (status),
  INDEX idx_haras_stays_animal (animal_id),
  CONSTRAINT fk_haras_stays_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  CONSTRAINT fk_haras_stays_owner FOREIGN KEY (owner_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_haras_stays_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS haras_finance_entries (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_type      ENUM('receita','despesa') NOT NULL,
  category        VARCHAR(40) NOT NULL DEFAULT 'outros',
  amount          DECIMAL(12,2) NOT NULL,
  entry_date      DATE NOT NULL,
  description     VARCHAR(255) NOT NULL,
  animal_id       BIGINT UNSIGNED NULL,
  stay_id         BIGINT UNSIGNED NULL,
  notes           TEXT NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_haras_fin_date (entry_date),
  INDEX idx_haras_fin_type (entry_type),
  CONSTRAINT fk_haras_fin_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL,
  CONSTRAINT fk_haras_fin_stay FOREIGN KEY (stay_id) REFERENCES haras_stays(id) ON DELETE SET NULL,
  CONSTRAINT fk_haras_fin_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
