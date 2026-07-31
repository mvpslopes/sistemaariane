-- =========================================================
-- Clicksign: metadados de envio para assinatura digital
-- =========================================================

SET NAMES utf8mb4;

ALTER TABLE contracts
  ADD COLUMN clicksign_envelope_id VARCHAR(64) NULL AFTER via_label,
  ADD COLUMN clicksign_document_id VARCHAR(64) NULL AFTER clicksign_envelope_id,
  ADD COLUMN clicksign_status VARCHAR(40) NULL AFTER clicksign_document_id,
  ADD COLUMN clicksign_sent_at DATETIME NULL AFTER clicksign_status;

