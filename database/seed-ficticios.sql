-- =========================================================
-- Dados fictícios — 10 clientes + 5 animais cada (50 animais)
-- Banco: u179630068_mvp_ariane
-- Execute no phpMyAdmin após o schema.sql
-- =========================================================
-- Prefixo FIC / CHIP-FIC para facilitar limpeza depois.
-- =========================================================

SET NAMES utf8mb4;

-- Limpa seed anterior (se reexecutar)
DELETE ao FROM animal_owners ao
INNER JOIN clients c ON c.id = ao.client_id
WHERE c.document LIKE 'FIC%';

DELETE ag FROM animal_genealogy ag
INNER JOIN animals a ON a.id = ag.animal_id
WHERE a.chip_no LIKE 'CHIP-FIC-%';

DELETE FROM animals WHERE chip_no LIKE 'CHIP-FIC-%';
DELETE FROM clients WHERE document LIKE 'FIC%';

-- ---------------------------------------------------------
-- 10 clientes fictícios
-- ---------------------------------------------------------
INSERT INTO clients
  (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active)
VALUES
  ('Haras Boa Esperança', 'CNPJ', 'FIC00000001', 'contato@boaespranca.fic.br', '(34) 3333-1001', '5534999100001', 'Uberaba', 'MG', 'Rod. BR-050, km 120', 'Cliente fictício — Mangalarga Marchador', 1),
  ('Fazenda Santa Luzia', 'CNPJ', 'FIC00000002', 'admin@santaluzia.fic.br', '(16) 3333-1002', '5516999100002', 'Ribeirão Preto', 'SP', 'Estrada Municipal 45', 'Cliente fictício — foco em exposição', 1),
  ('Criatório Vale Verde', 'CPF', 'FIC00000003', 'joao.silva@valeverde.fic.br', '(31) 3333-1003', '5531999100003', 'Belo Horizonte', 'MG', 'Rua das Palmeiras, 210', 'Cliente fictício — plantel jovem', 1),
  ('Haras Horizonte Azul', 'CNPJ', 'FIC00000004', 'equipe@horizonteazul.fic.br', '(62) 3333-1004', '5562999100004', 'Goiânia', 'GO', 'GO-060, km 18', 'Cliente fictício — ABQM e MM', 1),
  ('Rancho Três Irmãos', 'CPF', 'FIC00000005', 'maria.oliveira@tresirmaos.fic.br', '(19) 3333-1005', '5519999100005', 'Campinas', 'SP', 'Av. Rural, 780', 'Cliente fictício — pensionato e cria', 1),
  ('Haras Serra Dourada', 'CNPJ', 'FIC00000006', 'contato@serradourada.fic.br', '(35) 3333-1006', '5535999100006', 'Poços de Caldas', 'MG', 'Estrada da Serra, s/n', 'Cliente fictício — linhagem elite', 1),
  ('Fazenda Campo Belo', 'CPF', 'FIC00000007', 'carlos.mendes@campobelo.fic.br', '(67) 3333-1007', '5567999100007', 'Campo Grande', 'MS', 'MS-080, km 32', 'Cliente fictício — transferência embrião', 1),
  ('Haras Água Clara', 'CNPJ', 'FIC00000008', 'financeiro@aguaclara.fic.br', '(21) 3333-1008', '5521999100008', 'Barra do Piraí', 'RJ', 'Estrada RJ-145, km 9', 'Cliente fictício — prova funcional', 1),
  ('Criatório Sol Nascente', 'CPF', 'FIC00000009', 'ana.costa@solnascente.fic.br', '(85) 3333-1009', '5585999100009', 'Fortaleza', 'CE', 'CE-040, km 55', 'Cliente fictício — nordeste', 1),
  ('Haras Estrela do Sul', 'CNPJ', 'FIC00000010', 'gestao@estreladosul.fic.br', '(51) 3333-1010', '5551999100010', 'Gramado', 'RS', 'RS-235, km 12', 'Cliente fictício — sul do Brasil', 1);

-- ---------------------------------------------------------
-- 50 animais (5 por cliente) + vínculo em animal_owners
-- Chip: CHIP-FIC-XX-Y  (XX = cliente 01..10, Y = 1..5)
-- ---------------------------------------------------------

INSERT INTO animals
  (name, registration_no, chip_no, sex, breed, association, birth_date, color, resenha, status, ownership_type, notes)
VALUES
  -- Cliente 01 — Haras Boa Esperança
  ('Imperador da Esperança', 'ABCCMM-FIC-0101', 'CHIP-FIC-01-1', 'M', 'Mangalarga Marchador', 'ABCCMM', '2019-03-12', 'Castanho', 'Estrela na testa, pé esquerdo branco', 'ativo', 'unico', 'Seed fictício'),
  ('Princesa Boa Vista', 'ABCCMM-FIC-0102', 'CHIP-FIC-01-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2020-07-22', 'Alazã', 'Sem marcas especiais', 'ativo', 'unico', 'Seed fictício'),
  ('Cometa do Cerrado', 'ABCCMM-FIC-0103', 'CHIP-FIC-01-3', 'M', 'Mangalarga Marchador', 'ABCCMM', '2018-11-05', 'Tordilho', 'Calçado nos quatro', 'ativo', 'unico', 'Seed fictício'),
  ('Lua da Esperança', 'ABCCMM-FIC-0104', 'CHIP-FIC-01-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2021-01-18', 'Preta', 'Faixa facial estreita', 'ativo', 'unico', 'Seed fictício'),
  ('Relâmpago MG', 'ABCCMM-FIC-0105', 'CHIP-FIC-01-5', 'M', 'Mangalarga Marchador', 'ABCCMM', '2017-09-30', 'Baio', 'Estrela irregular', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 02 — Fazenda Santa Luzia
  ('Diamante Luzia', 'ABCCMM-FIC-0201', 'CHIP-FIC-02-1', 'M', 'Mangalarga Marchador', 'ABCCMM', '2018-04-14', 'Castanho escuro', 'Pé direito anterior branco', 'ativo', 'unico', 'Seed fictício'),
  ('Estrela Santa Luzia', 'ABCCMM-FIC-0202', 'CHIP-FIC-02-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2019-08-09', 'Alazã tostada', 'Sem marcações', 'ativo', 'unico', 'Seed fictício'),
  ('Troféu do Vale', 'ABQM-FIC-0203', 'CHIP-FIC-02-3', 'M', 'Quarto de Milha', 'ABQM', '2020-02-27', 'Sorrel', 'Blaze médio', 'ativo', 'unico', 'Seed fictício'),
  ('Belíssima Luzia', 'ABCCMM-FIC-0204', 'CHIP-FIC-02-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2021-06-03', 'Tordilha', 'Calçada posterior esquerda', 'ativo', 'unico', 'Seed fictício'),
  ('Furacão SP', 'ABQM-FIC-0205', 'CHIP-FIC-02-5', 'M', 'Quarto de Milha', 'ABQM', '2016-12-19', 'Bay', 'Snip no focinho', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 03 — Criatório Vale Verde
  ('Verde Imperial', 'ABCCMM-FIC-0301', 'CHIP-FIC-03-1', 'M', 'Mangalarga Marchador', 'ABCCMM', '2019-05-21', 'Castanho', 'Estrela pequena', 'ativo', 'unico', 'Seed fictício'),
  ('Jasmim do Vale', 'ABCCMM-FIC-0302', 'CHIP-FIC-03-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2020-10-11', 'Alazã', 'Meia luar', 'ativo', 'unico', 'Seed fictício'),
  ('Trovão Verde', 'ABCCMM-FIC-0303', 'CHIP-FIC-03-3', 'M', 'Mangalarga Marchador', 'ABCCMM', '2018-01-07', 'Preto', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Camélia Mineira', 'ABCCMM-FIC-0304', 'CHIP-FIC-03-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2022-03-15', 'Baia', 'Pé esquerdo branco', 'ativo', 'unico', 'Seed fictício'),
  ('Pegasus Vale', 'OUTRA-FIC-0305', 'CHIP-FIC-03-5', 'M', 'Cruzado', 'OUTRA', '2017-07-28', 'Tordilho', 'Calçado nos posteriores', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 04 — Haras Horizonte Azul
  ('Azulão do Planalto', 'ABQM-FIC-0401', 'CHIP-FIC-04-1', 'M', 'Quarto de Milha', 'ABQM', '2018-06-16', 'Buckskin', 'Blaze largo', 'ativo', 'unico', 'Seed fictício'),
  ('Safira Horizonte', 'ABCCMM-FIC-0402', 'CHIP-FIC-04-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2019-09-02', 'Castanha', 'Estrela e snip', 'ativo', 'unico', 'Seed fictício'),
  ('Raio de Goiás', 'ABQM-FIC-0403', 'CHIP-FIC-04-3', 'M', 'Quarto de Milha', 'ABQM', '2020-12-08', 'Palomino', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Íris do Cerrado', 'ABCCMM-FIC-0404', 'CHIP-FIC-04-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2021-04-25', 'Alazã', 'Calçada anterior direita', 'ativo', 'unico', 'Seed fictício'),
  ('Tempestade GO', 'ABQM-FIC-0405', 'CHIP-FIC-04-5', 'M', 'Quarto de Milha', 'ABQM', '2017-02-14', 'Bay roano', 'Meia luar', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 05 — Rancho Três Irmãos
  ('Irmão Maior', 'ABCCMM-FIC-0501', 'CHIP-FIC-05-1', 'M', 'Mangalarga Marchador', 'ABCCMM', '2018-08-19', 'Castanho', 'Estrela triangular', 'ativo', 'unico', 'Seed fictício'),
  ('Dama dos Três', 'ABCCMM-FIC-0502', 'CHIP-FIC-05-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2019-11-30', 'Preta', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Vendaval Campineiro', 'ABCCMM-FIC-0503', 'CHIP-FIC-05-3', 'M', 'Mangalarga Marchador', 'ABCCMM', '2020-05-06', 'Baio', 'Pé esquerdo posterior branco', 'ativo', 'unico', 'Seed fictício'),
  ('Flor do Rancho', 'ABCCMM-FIC-0504', 'CHIP-FIC-05-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2021-09-17', 'Tordilha', 'Faixa facial', 'ativo', 'unico', 'Seed fictício'),
  ('Corsário SP', 'OUTRA-FIC-0505', 'CHIP-FIC-05-5', 'M', 'Crioulo', 'OUTRA', '2016-10-23', 'Overo', 'Manchas irregulares', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 06 — Haras Serra Dourada
  ('Ouro da Serra', 'ABCCMM-FIC-0601', 'CHIP-FIC-06-1', 'M', 'Mangalarga Marchador', 'ABCCMM', '2017-04-02', 'Alazão', 'Estrela grande', 'ativo', 'unico', 'Seed fictício'),
  ('Dourada Imperial', 'ABCCMM-FIC-0602', 'CHIP-FIC-06-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2018-12-11', 'Castanha clara', 'Calçada nos quatro', 'ativo', 'unico', 'Seed fictício'),
  ('Pico Dourado', 'ABCCMM-FIC-0603', 'CHIP-FIC-06-3', 'M', 'Mangalarga Marchador', 'ABCCMM', '2019-06-27', 'Preto', 'Snip', 'ativo', 'unico', 'Seed fictício'),
  ('Aurora da Serra', 'ABCCMM-FIC-0604', 'CHIP-FIC-06-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2020-09-14', 'Baia', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Monarca das Águas', 'ABCCMM-FIC-0605', 'CHIP-FIC-06-5', 'M', 'Mangalarga Marchador', 'ABCCMM', '2021-02-08', 'Tordilho', 'Meia luar e pé branco', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 07 — Fazenda Campo Belo
  ('Belo Campo', 'ABQM-FIC-0701', 'CHIP-FIC-07-1', 'M', 'Quarto de Milha', 'ABQM', '2018-03-20', 'Chestnut', 'Blaze', 'ativo', 'unico', 'Seed fictício'),
  ('Campo Florido', 'ABCCMM-FIC-0702', 'CHIP-FIC-07-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2019-07-01', 'Alazã', 'Estrela', 'ativo', 'unico', 'Seed fictício'),
  ('Pantaneiro Real', 'ABQM-FIC-0703', 'CHIP-FIC-07-3', 'M', 'Quarto de Milha', 'ABQM', '2020-01-29', 'Bay', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Brisa do Campo', 'ABCCMM-FIC-0704', 'CHIP-FIC-07-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2021-08-12', 'Castanha', 'Pé direito branco', 'ativo', 'unico', 'Seed fictício'),
  ('Jaguar MS', 'OUTRA-FIC-0705', 'CHIP-FIC-07-5', 'M', 'Pantaneiro', 'OUTRA', '2017-05-05', 'Gateado', 'Lista facial', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 08 — Haras Água Clara
  ('Clara Corrente', 'ABCCMM-FIC-0801', 'CHIP-FIC-08-1', 'F', 'Mangalarga Marchador', 'ABCCMM', '2018-10-16', 'Tordilha', 'Calçada anterior esquerda', 'ativo', 'unico', 'Seed fictício'),
  ('Rio Claro', 'ABCCMM-FIC-0802', 'CHIP-FIC-08-2', 'M', 'Mangalarga Marchador', 'ABCCMM', '2019-02-24', 'Castanho', 'Estrela oval', 'ativo', 'unico', 'Seed fictício'),
  ('Cascata Azul', 'ABCCMM-FIC-0803', 'CHIP-FIC-08-3', 'F', 'Mangalarga Marchador', 'ABCCMM', '2020-06-18', 'Preta', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Maré Alta', 'ABQM-FIC-0804', 'CHIP-FIC-08-4', 'M', 'Quarto de Milha', 'ABQM', '2021-11-03', 'Gray', 'Blaze fino', 'ativo', 'unico', 'Seed fictício'),
  ('Náutilus RJ', 'ABCCMM-FIC-0805', 'CHIP-FIC-08-5', 'M', 'Mangalarga Marchador', 'ABCCMM', '2016-08-07', 'Baio', 'Calçado nos posteriores', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 09 — Criatório Sol Nascente
  ('Nascente do Sol', 'ABCCMM-FIC-0901', 'CHIP-FIC-09-1', 'M', 'Mangalarga Marchador', 'ABCCMM', '2019-01-13', 'Alazão', 'Estrela e snip', 'ativo', 'unico', 'Seed fictício'),
  ('Aurora Cearense', 'ABCCMM-FIC-0902', 'CHIP-FIC-09-2', 'F', 'Mangalarga Marchador', 'ABCCMM', '2020-04-09', 'Castanha', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Nordestino Real', 'OUTRA-FIC-0903', 'CHIP-FIC-09-3', 'M', 'Mangalarga Paulista', 'OUTRA', '2018-09-26', 'Tordilho', 'Meia luar', 'ativo', 'unico', 'Seed fictício'),
  ('Areia Branca', 'ABCCMM-FIC-0904', 'CHIP-FIC-09-4', 'F', 'Mangalarga Marchador', 'ABCCMM', '2021-12-21', 'Baia', 'Pé esquerdo branco', 'ativo', 'unico', 'Seed fictício'),
  ('Ventania CE', 'ABCCMM-FIC-0905', 'CHIP-FIC-09-5', 'M', 'Mangalarga Marchador', 'ABCCMM', '2017-11-15', 'Preto', 'Faixa facial estreita', 'ativo', 'unico', 'Seed fictício'),

  -- Cliente 10 — Haras Estrela do Sul
  ('Estrela Gaúcha', 'ABCCMM-FIC-1001', 'CHIP-FIC-10-1', 'F', 'Mangalarga Marchador', 'ABCCMM', '2018-05-28', 'Castanha', 'Estrela', 'ativo', 'unico', 'Seed fictício'),
  ('Sulista Campeão', 'ABCCMM-FIC-1002', 'CHIP-FIC-10-2', 'M', 'Mangalarga Marchador', 'ABCCMM', '2019-10-04', 'Alazão', 'Calçado nos quatro', 'ativo', 'unico', 'Seed fictício'),
  ('Neve dos Pampas', 'OUTRA-FIC-1003', 'CHIP-FIC-10-3', 'F', 'Crioulo', 'OUTRA', '2020-03-22', 'Tordilha', 'Sem marcas', 'ativo', 'unico', 'Seed fictício'),
  ('Pampa Real', 'OUTRA-FIC-1004', 'CHIP-FIC-10-4', 'M', 'Crioulo', 'OUTRA', '2021-07-19', 'Overo', 'Manchas brancas irregulares', 'ativo', 'unico', 'Seed fictício'),
  ('Serra Gaúcha', 'ABCCMM-FIC-1005', 'CHIP-FIC-10-5', 'F', 'Mangalarga Marchador', 'ABCCMM', '2016-06-10', 'Baia', 'Pé direito posterior branco', 'ativo', 'unico', 'Seed fictício');

-- Vínculos proprietário (100%)
INSERT INTO animal_owners (animal_id, client_id, share_pct, is_primary)
SELECT a.id, c.id, 100.00, 1
FROM animals a
INNER JOIN clients c ON (
  (a.chip_no LIKE 'CHIP-FIC-01-%' AND c.document = 'FIC00000001') OR
  (a.chip_no LIKE 'CHIP-FIC-02-%' AND c.document = 'FIC00000002') OR
  (a.chip_no LIKE 'CHIP-FIC-03-%' AND c.document = 'FIC00000003') OR
  (a.chip_no LIKE 'CHIP-FIC-04-%' AND c.document = 'FIC00000004') OR
  (a.chip_no LIKE 'CHIP-FIC-05-%' AND c.document = 'FIC00000005') OR
  (a.chip_no LIKE 'CHIP-FIC-06-%' AND c.document = 'FIC00000006') OR
  (a.chip_no LIKE 'CHIP-FIC-07-%' AND c.document = 'FIC00000007') OR
  (a.chip_no LIKE 'CHIP-FIC-08-%' AND c.document = 'FIC00000008') OR
  (a.chip_no LIKE 'CHIP-FIC-09-%' AND c.document = 'FIC00000009') OR
  (a.chip_no LIKE 'CHIP-FIC-10-%' AND c.document = 'FIC00000010')
)
WHERE a.chip_no LIKE 'CHIP-FIC-%';

-- Genealogia textual (pai/mãe fictícios)
INSERT INTO animal_genealogy (animal_id, sire_name, dam_name)
SELECT a.id,
  CASE
    WHEN a.sex = 'M' THEN CONCAT('Pai de ', a.name)
    ELSE CONCAT('Sire ', SUBSTRING(a.chip_no, 10, 2))
  END,
  CASE
    WHEN a.sex = 'F' THEN CONCAT('Mãe de ', a.name)
    ELSE CONCAT('Dam ', SUBSTRING(a.chip_no, 10, 2))
  END
FROM animals a
WHERE a.chip_no LIKE 'CHIP-FIC-%'
ON DUPLICATE KEY UPDATE
  sire_name = VALUES(sire_name),
  dam_name = VALUES(dam_name);

-- Fotos de demonstração (LoremFlickr — cavalo único por id)
UPDATE animals
SET photo_url = CONCAT('https://loremflickr.com/400/400/horse,equine?lock=', id)
WHERE chip_no LIKE 'CHIP-FIC-%';

-- Conferência rápida
SELECT
  (SELECT COUNT(*) FROM clients WHERE document LIKE 'FIC%') AS clientes_ficticios,
  (SELECT COUNT(*) FROM animals WHERE chip_no LIKE 'CHIP-FIC-%') AS animais_ficticios,
  (SELECT COUNT(*) FROM animal_owners ao
     INNER JOIN clients c ON c.id = ao.client_id
     WHERE c.document LIKE 'FIC%') AS vinculos;
