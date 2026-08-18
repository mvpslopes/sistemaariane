-- Mapeia IDs antigos de signatários Clicksign → novos (após atualização de e-mail)
ALTER TABLE contracts
  ADD COLUMN clicksign_signer_aliases JSON NULL AFTER clicksign_total_count;
