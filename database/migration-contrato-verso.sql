-- Verso editável por contrato (sobrescreve o modelo)
-- Execute no phpMyAdmin

ALTER TABLE contracts
  ADD COLUMN verso_title VARCHAR(255) NULL AFTER template_id,
  ADD COLUMN verso_body MEDIUMTEXT NULL AFTER verso_title;
