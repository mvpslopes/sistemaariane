-- Número do endereço em pessoas (clients)
-- Execute no phpMyAdmin

ALTER TABLE clients
  ADD COLUMN address_number VARCHAR(20) NULL AFTER address;
