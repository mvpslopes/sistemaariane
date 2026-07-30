-- =========================================================
-- Dados fictícios — Leilões (22 registros)
-- Execute no phpMyAdmin após migration-leiloes-repasses.sql
-- Prefixo FIC-LEI nas notas para facilitar limpeza
-- =========================================================

SET NAMES utf8mb4;

-- Limpa seed anterior de leilões fictícios (lotes em cascata)
DELETE FROM auctions WHERE notes LIKE 'FIC-LEI%';

INSERT INTO auctions
  (name, auction_date, location, organizer, status, notes, created_by)
VALUES
  ('Leilão Elite Mangalarga — Edição Primavera', '2025-09-15', 'Uberaba, MG', 'Ariane Andrade Assessoria', 'encerrado', 'FIC-LEI — plantel elite ABCCMM', NULL),
  ('Leilão Haras do Cerrado 2025', '2025-10-22', 'Goiânia, GO', 'Haras Horizonte Azul', 'encerrado', 'FIC-LEI — foco ABQM e MM', NULL),
  ('Leilão Virtual Vale Verde', '2025-11-08', 'Online (plataforma externa)', 'Criatório Vale Verde', 'encerrado', 'FIC-LEI — transmissão externa', NULL),
  ('Leilão de Éguas Prenhas — Santa Luzia', '2025-12-05', 'Ribeirão Preto, SP', 'Fazenda Santa Luzia', 'encerrado', 'FIC-LEI — matriz e embrião', NULL),
  ('Leilão Anual Boa Esperança', '2026-01-18', 'Uberaba, MG', 'Haras Boa Esperança', 'encerrado', 'FIC-LEI — edição anual', NULL),
  ('Leilão Potros 2 anos — Serra Dourada', '2026-02-14', 'Poços de Caldas, MG', 'Haras Serra Dourada', 'encerrado', 'FIC-LEI — geração 2024', NULL),
  ('Leilão Funcional Campo Belo', '2026-03-07', 'Campo Grande, MS', 'Fazenda Campo Belo', 'agendado', 'FIC-LEI — prova e venda', NULL),
  ('Leilão Água Clara — Linhagens de Prova', '2026-03-21', 'Barra do Piraí, RJ', 'Haras Água Clara', 'agendado', 'FIC-LEI — funcional', NULL),
  ('Leilão Nordeste Sol Nascente', '2026-04-11', 'Fortaleza, CE', 'Criatório Sol Nascente', 'agendado', 'FIC-LEI — circuito nordeste', NULL),
  ('Leilão Estrela do Sul — Gramado', '2026-04-25', 'Gramado, RS', 'Haras Estrela do Sul', 'agendado', 'FIC-LEI — sul do Brasil', NULL),
  ('Leilão Três Irmãos — Pensionato e Cria', '2026-05-09', 'Campinas, SP', 'Rancho Três Irmãos', 'agendado', 'FIC-LEI — cria e recria', NULL),
  ('Leilão Especial Frações — Assessoria Ariane', '2026-05-23', 'Belo Horizonte, MG', 'Ariane Andrade Assessoria', 'rascunho', 'FIC-LEI — venda em fração', NULL),
  ('Leilão Embriões e Receptoras 2026', '2026-06-06', 'Uberaba, MG', 'Ariane Andrade Assessoria', 'rascunho', 'FIC-LEI — TE e receptoras', NULL),
  ('Leilão Inverno Mangalarga Marchador', '2026-06-20', 'Avaré, SP', 'Associação Regional MM', 'rascunho', 'FIC-LEI — edição inverno', NULL),
  ('Leilão Quarto de Milha — Centro-Oeste', '2026-07-04', 'Brasília, DF', 'Circuito ABQM Centro-Oeste', 'rascunho', 'FIC-LEI — ABQM', NULL),
  ('Leilão Virtual Noturno — Plantel Jovem', '2026-07-18', 'Online (plataforma externa)', 'Ariane Andrade Assessoria', 'rascunho', 'FIC-LEI — ao vivo fora do sistema', NULL),
  ('Leilão Beneficente Haras Unidos', '2026-08-01', 'São Paulo, SP', 'Haras Unidos do Brasil', 'cancelado', 'FIC-LEI — cancelado por agenda', NULL),
  ('Leilão de Garanhões — Temporada 2026/27', '2026-08-15', 'Uberaba, MG', 'Ariane Andrade Assessoria', 'rascunho', 'FIC-LEI — cobertura e sêmen', NULL),
  ('Leilão Express — Lotes Únicos', '2026-08-29', 'Ribeirão Preto, SP', 'Casa de Leilões Interior', 'agendado', 'FIC-LEI — poucos lotes premium', NULL),
  ('Leilão Condomínio Equino — Partes Ideais', '2026-09-12', 'Campinas, SP', 'Ariane Andrade Assessoria', 'rascunho', 'FIC-LEI — condomínio', NULL),
  ('Leilão Primavera 2026 — Edição Nacional', '2026-09-26', 'Uberaba, MG', 'Ariane Andrade Assessoria', 'em_andamento', 'FIC-LEI — edição principal do ano', NULL),
  ('Leilão de Desmama — Geração 2026', '2026-10-10', 'Goiânia, GO', 'Haras Horizonte Azul', 'agendado', 'FIC-LEI — potros desmamados', NULL);

-- Lotes de exemplo (só se existirem animais/clientes do seed-ficticios)
-- Usa os 2 primeiros leilões FIC-LEI e animais CHIP-FIC-*

INSERT INTO auction_lots
  (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
SELECT a.id, an.id, '01', c.id, 45000.00, 'Animal inteiro — pagamento em até 12x', 'disponivel'
FROM auctions a
CROSS JOIN animals an
CROSS JOIN clients c
WHERE a.notes = 'FIC-LEI — plantel elite ABCCMM'
  AND an.chip_no = 'CHIP-FIC-01-1'
  AND c.document = 'FIC00000001'
LIMIT 1;

INSERT INTO auction_lots
  (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
SELECT a.id, an.id, '02', c.id, 38000.00, 'Animal inteiro — entrada 30%', 'disponivel'
FROM auctions a
CROSS JOIN animals an
CROSS JOIN clients c
WHERE a.notes = 'FIC-LEI — plantel elite ABCCMM'
  AND an.chip_no = 'CHIP-FIC-01-2'
  AND c.document = 'FIC00000001'
LIMIT 1;

INSERT INTO auction_lots
  (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
SELECT a.id, an.id, '01', c.id, 52000.00, 'Fração 50% — condomínio', 'disponivel'
FROM auctions a
CROSS JOIN animals an
CROSS JOIN clients c
WHERE a.notes = 'FIC-LEI — foco ABQM e MM'
  AND an.chip_no = 'CHIP-FIC-04-1'
  AND c.document = 'FIC00000004'
LIMIT 1;

INSERT INTO auction_lots
  (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
SELECT a.id, an.id, '03', c.id, 29000.00, 'Animal inteiro — à vista com 5% desconto', 'disponivel'
FROM auctions a
CROSS JOIN animals an
CROSS JOIN clients c
WHERE a.notes = 'FIC-LEI — edição principal do ano'
  AND an.chip_no = 'CHIP-FIC-02-1'
  AND c.document = 'FIC00000002'
LIMIT 1;

INSERT INTO auction_lots
  (auction_id, animal_id, lot_number, seller_id, min_price, conditions_text, status)
SELECT a.id, an.id, '04', c.id, 61000.00, 'Égua prenha — documentação inclusa', 'disponivel'
FROM auctions a
CROSS JOIN animals an
CROSS JOIN clients c
WHERE a.notes = 'FIC-LEI — edição principal do ano'
  AND an.chip_no = 'CHIP-FIC-06-2'
  AND c.document = 'FIC00000006'
LIMIT 1;
