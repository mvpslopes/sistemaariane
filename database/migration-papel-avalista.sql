-- Papel avalista em pessoas (clients)
-- Execute no phpMyAdmin

ALTER TABLE clients
  ADD COLUMN is_avalista TINYINT(1) NOT NULL DEFAULT 0 AFTER is_witness;
