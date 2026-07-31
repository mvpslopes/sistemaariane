-- Categorias de animal e cotas (catálogo)
-- Execute no phpMyAdmin após migration-animal-catalogos.sql

ALTER TABLE catalogs
  MODIFY COLUMN kind ENUM('breed','sale_type','animal_category','share_quota') NOT NULL;

INSERT INTO catalogs (kind, name, code) VALUES
  ('animal_category', 'POTRA', 'POTRA'),
  ('animal_category', 'POTRO', 'POTRO'),
  ('animal_category', 'ÉGUA', 'EGUA'),
  ('animal_category', 'GARANHÃO', 'GARANHAO'),
  ('animal_category', 'CASTRADO', 'CASTRADO'),
  ('animal_category', 'MATRIZ', 'MATRIZ'),
  ('share_quota', '100%', '100'),
  ('share_quota', '50%', '50'),
  ('share_quota', '25%', '25'),
  ('share_quota', '12,5%', '12.5'),
  ('share_quota', '6,25%', '6.25')
ON DUPLICATE KEY UPDATE name = VALUES(name);
