-- Novo status: pendente_envio (criado / envio cancelado, ainda sem envelope Clicksign).
-- aguardando_assinatura = já enviado, faltam assinar.
-- Rodar no phpMyAdmin.

ALTER TABLE contracts
  MODIFY COLUMN status ENUM(
    'rascunho',
    'pendente_envio',
    'aguardando_assinatura',
    'ativo',
    'concluido',
    'cancelado'
  ) NOT NULL DEFAULT 'pendente_envio';

-- Contratos ainda não enviados à Clicksign
UPDATE contracts
SET status = 'pendente_envio'
WHERE clicksign_envelope_id IS NULL
  AND status IN ('rascunho', 'aguardando_assinatura');

-- Casos do bug: cancelamento da Clicksign marcava como Ativo sem envelope
UPDATE contracts
SET status = 'pendente_envio'
WHERE clicksign_envelope_id IS NULL
  AND status = 'ativo'
  AND (clicksign_status IS NULL OR clicksign_status = '' OR clicksign_status IN ('canceled', 'cancelled'));
