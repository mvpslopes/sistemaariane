-- Sexo castrado + catálogos (raça e tipo de venda)
-- Execute no phpMyAdmin

-- Sexo: M, F, C (castrado)
ALTER TABLE animals
  MODIFY COLUMN sex ENUM('M','F','C') NULL;

-- Tipo de venda expansível (além de inteiro/fracao/condominio)
ALTER TABLE contracts
  MODIFY COLUMN sale_type VARCHAR(40) NOT NULL DEFAULT 'inteiro';

CREATE TABLE IF NOT EXISTS catalogs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind       ENUM('breed','sale_type') NOT NULL,
  name       VARCHAR(120) NOT NULL,
  code       VARCHAR(40) NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_catalog_kind_name (kind, name),
  INDEX idx_catalog_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO catalogs (kind, name, code) VALUES
  ('breed', 'Mangalarga Marchador', 'MM'),
  ('breed', 'Quarto de Milha', 'QM'),
  ('breed', 'Crioulo', NULL),
  ('breed', 'Campolina', NULL),
  ('breed', 'Árabe', NULL),
  ('sale_type', 'Animal inteiro', 'inteiro'),
  ('sale_type', 'Fração', 'fracao'),
  ('sale_type', 'Condomínio', 'condominio')
ON DUPLICATE KEY UPDATE name = VALUES(name);
