-- =========================================================
-- Via única do contrato: VENDEDOR E COMPRADOR
-- Banco: Sistema Ariane
--
-- Atualiza o rótulo padrão e os contratos que ainda estão
-- com "VIA - VENDEDOR / CONTRATO".
-- =========================================================

SET NAMES utf8mb4;

ALTER TABLE contracts
  MODIFY COLUMN via_label VARCHAR(80) NULL DEFAULT 'VIA DAS PARTES — VENDEDOR E COMPRADOR';

UPDATE contracts
SET via_label = 'VIA DAS PARTES — VENDEDOR E COMPRADOR'
WHERE via_label IS NULL
   OR via_label = ''
   OR via_label = 'VIA - VENDEDOR / CONTRATO';
