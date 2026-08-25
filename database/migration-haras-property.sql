-- Vincula os módulos de haras às propriedades cadastradas em Pessoas
-- e amplia o plano SaaS (estoque, hospedagem, financeiro do haras).
-- Rode depois de database/migration-haras-modules.sql

ALTER TABLE client_modules
  MODIFY COLUMN module_code ENUM(
    'plantel',
    'reproducao',
    'sanitario',
    'contratos',
    'leiloes',
    'estoque',
    'hospedagem',
    'financeiro_haras'
  ) NOT NULL;

ALTER TABLE haras_vet_records
  ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER id,
  ADD INDEX idx_haras_vet_property (property_id),
  ADD CONSTRAINT fk_haras_vet_property FOREIGN KEY (property_id) REFERENCES client_properties(id) ON DELETE SET NULL;

ALTER TABLE haras_stock_items
  ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER id,
  ADD INDEX idx_haras_stock_property (property_id),
  ADD CONSTRAINT fk_haras_stock_property FOREIGN KEY (property_id) REFERENCES client_properties(id) ON DELETE SET NULL;

ALTER TABLE haras_stays
  ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER id,
  ADD INDEX idx_haras_stays_property (property_id),
  ADD CONSTRAINT fk_haras_stays_property FOREIGN KEY (property_id) REFERENCES client_properties(id) ON DELETE SET NULL;

ALTER TABLE haras_finance_entries
  ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER id,
  ADD INDEX idx_haras_fin_property (property_id),
  ADD CONSTRAINT fk_haras_fin_property FOREIGN KEY (property_id) REFERENCES client_properties(id) ON DELETE SET NULL;
