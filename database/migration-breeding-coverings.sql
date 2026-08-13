-- Módulo Reprodução (MVP): cobrições
-- Rodar no phpMyAdmin se ainda não aplicada.

CREATE TABLE IF NOT EXISTS breeding_coverings (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mare_animal_id      BIGINT UNSIGNED NOT NULL,
  stallion_animal_id  BIGINT UNSIGNED NULL,
  stallion_name       VARCHAR(255) NULL,
  method              ENUM('ia','monta_natural','te') NOT NULL DEFAULT 'ia',
  covering_date       DATE NOT NULL,
  season              VARCHAR(40) NULL,
  veterinarian        VARCHAR(255) NULL,
  abccmm_status       ENUM('pendente','comunicado','confirmado') NOT NULL DEFAULT 'pendente',
  notes               TEXT NULL,
  created_by          BIGINT UNSIGNED NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bc_date (covering_date),
  INDEX idx_bc_mare (mare_animal_id),
  INDEX idx_bc_abccmm (abccmm_status),
  CONSTRAINT fk_bc_mare FOREIGN KEY (mare_animal_id) REFERENCES animals(id) ON DELETE CASCADE,
  CONSTRAINT fk_bc_stallion FOREIGN KEY (stallion_animal_id) REFERENCES animals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
