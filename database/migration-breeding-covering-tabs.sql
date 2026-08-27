-- Abas da cobertura: protocolo ABCCMM, previsão de gestação (~11 meses),
-- transferência de embrião, procedimentos, exames e parto.
-- Rodar no phpMyAdmin após database/migration-breeding-coverings.sql

ALTER TABLE breeding_coverings
  ADD COLUMN association_protocol VARCHAR(80) NULL AFTER abccmm_status,
  ADD COLUMN expected_due_date DATE NULL AFTER association_protocol,
  ADD COLUMN expected_due_start DATE NULL AFTER expected_due_date,
  ADD COLUMN expected_due_end DATE NULL AFTER expected_due_start,
  ADD COLUMN recipient_animal_id BIGINT UNSIGNED NULL AFTER expected_due_end,
  ADD COLUMN embryo_transfer_date DATE NULL AFTER recipient_animal_id,
  ADD COLUMN embryo_transfer_status VARCHAR(40) NULL AFTER embryo_transfer_date,
  ADD COLUMN embryo_transfer_notes TEXT NULL AFTER embryo_transfer_status,
  ADD COLUMN procedures_notes TEXT NULL AFTER embryo_transfer_notes,
  ADD COLUMN lab_exams_notes TEXT NULL AFTER procedures_notes,
  ADD COLUMN birth_date DATE NULL AFTER lab_exams_notes,
  ADD COLUMN birth_status ENUM('previsto','nascido','aborto','nao_prenhe') NOT NULL DEFAULT 'previsto' AFTER birth_date,
  ADD COLUMN birth_notes TEXT NULL AFTER birth_status,
  ADD INDEX idx_bc_due (expected_due_date),
  ADD INDEX idx_bc_protocol (association_protocol),
  ADD CONSTRAINT fk_bc_recipient FOREIGN KEY (recipient_animal_id) REFERENCES animals(id) ON DELETE SET NULL;

-- Preenche a janela de parto nas cobrições já cadastradas (11 meses ± margem).
UPDATE breeding_coverings
SET
  expected_due_date = DATE_ADD(covering_date, INTERVAL 11 MONTH),
  expected_due_start = DATE_SUB(DATE_ADD(covering_date, INTERVAL 11 MONTH), INTERVAL 10 DAY),
  expected_due_end = DATE_ADD(DATE_ADD(covering_date, INTERVAL 11 MONTH), INTERVAL 15 DAY)
WHERE covering_date IS NOT NULL
  AND expected_due_date IS NULL;
