-- Contagem de assinaturas Clicksign (cache para listagem de contratos)
-- Rodar no phpMyAdmin se ainda não aplicada.

ALTER TABLE contracts
  ADD COLUMN clicksign_signed_count TINYINT UNSIGNED NULL AFTER clicksign_sent_at,
  ADD COLUMN clicksign_total_count TINYINT UNSIGNED NULL AFTER clicksign_signed_count;
