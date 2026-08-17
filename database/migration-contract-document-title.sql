-- Renomeia o título padrão do documento de contrato.
-- Execute no phpMyAdmin após backup.
--
-- Política recomendada:
-- 1) Atualiza modelos (novos contratos herdam o título novo).
-- 2) Atualiza contratos AINDA NÃO enviados ao Clicksign.
-- 3) NÃO altera contratos já enviados/assinados (integridade jurídica).

SET NAMES utf8mb4;

UPDATE contract_templates
SET title = 'CONTRATO PARTICULAR DE COMPRA E VENDA DE SEMOVENTE COM RESERVA DE DOMÍNIO'
WHERE title LIKE '%NOTA DE LEILÃO%'
   OR title LIKE '%NOTA DE LEILAO%';

UPDATE contracts c
SET c.verso_title = 'CONTRATO PARTICULAR DE COMPRA E VENDA DE SEMOVENTE COM RESERVA DE DOMÍNIO'
WHERE (c.verso_title IS NULL OR c.verso_title LIKE '%NOTA DE LEILÃO%' OR c.verso_title LIKE '%NOTA DE LEILAO%')
  AND c.clicksign_sent_at IS NULL
  AND c.status NOT IN ('cancelado', 'concluido', 'ativo');
