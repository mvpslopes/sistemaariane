-- =========================================================
-- LIMPAR DADOS OPERACIONAIS — cadastro do zero
-- Banco: Sistema Ariane
--
-- APAGA: pessoas, animais, contratos, cobranças, repasses,
--        leilões/lotes, documentos e vínculos.
--
-- MANTÉM:
--   - users (login root/admin/equipe)
--   - catalogs (raças, tipos de venda, cotas, etc.)
--   - contract_templates (modelos de verso)
--
-- ATENÇÃO: ação irreversível. Faça backup antes no phpMyAdmin.
-- Depois, se quiser, apague também os arquivos em:
--   uploads/animals/, uploads/persons/, uploads/avatars/
--   (exceto .gitkeep / .htaccess)
--
-- Usa DELETE (não TRUNCATE) para evitar erro #1701 com FKs na Hostinger.
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Repasses e regras financeiras
DELETE FROM payouts;
DELETE FROM contract_payout_rules;

-- Cobranças e assinaturas
DELETE FROM charges;
DELETE FROM contract_signatures;

-- Lotes / leilões
DELETE FROM auction_lot_sellers;
DELETE FROM auction_lots;
DELETE FROM auctions;

-- Contratos
DELETE FROM contracts;

-- Animais
DELETE FROM animal_genealogy;
DELETE FROM animal_owners;
DELETE FROM animals;

-- Pessoas
DELETE FROM client_documents;
DELETE FROM client_properties;
DELETE FROM client_bank_accounts;
DELETE FROM client_contacts;
DELETE FROM clients;

-- Desvincula usuário ↔ pessoa (mantém login)
UPDATE users SET client_id = NULL WHERE client_id IS NOT NULL;

-- Reinicia IDs (opcional, deixa o próximo cadastro começar do 1)
ALTER TABLE payouts AUTO_INCREMENT = 1;
ALTER TABLE contract_payout_rules AUTO_INCREMENT = 1;
ALTER TABLE charges AUTO_INCREMENT = 1;
ALTER TABLE contract_signatures AUTO_INCREMENT = 1;
ALTER TABLE auction_lot_sellers AUTO_INCREMENT = 1;
ALTER TABLE auction_lots AUTO_INCREMENT = 1;
ALTER TABLE auctions AUTO_INCREMENT = 1;
ALTER TABLE contracts AUTO_INCREMENT = 1;
ALTER TABLE animal_owners AUTO_INCREMENT = 1;
ALTER TABLE animals AUTO_INCREMENT = 1;
ALTER TABLE client_documents AUTO_INCREMENT = 1;
ALTER TABLE client_properties AUTO_INCREMENT = 1;
ALTER TABLE client_bank_accounts AUTO_INCREMENT = 1;
ALTER TABLE client_contacts AUTO_INCREMENT = 1;
ALTER TABLE clients AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- Conferência rápida (tudo deve retornar 0, exceto users/catalogs/templates)
SELECT 'clients' AS tabela, COUNT(*) AS qtd FROM clients
UNION ALL SELECT 'animals', COUNT(*) FROM animals
UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL SELECT 'charges', COUNT(*) FROM charges
UNION ALL SELECT 'auctions', COUNT(*) FROM auctions
UNION ALL SELECT 'auction_lots', COUNT(*) FROM auction_lots
UNION ALL SELECT 'users (mantidos)', COUNT(*) FROM users
UNION ALL SELECT 'catalogs (mantidos)', COUNT(*) FROM catalogs
UNION ALL SELECT 'contract_templates (mantidos)', COUNT(*) FROM contract_templates;
