-- =============================================================================
-- Seed: 15 compradores + 15 vendedores + 15 assessores (dados fictícios)
-- Rode após schema.sql e migration-contratos.sql
-- Prefixo SEED-COM / SEED-VEN / SEED-ASS para limpeza e reexecução
-- =============================================================================

SET NAMES utf8mb4;

DELETE FROM clients
WHERE document LIKE 'SEED-COM-%'
   OR document LIKE 'SEED-VEN-%'
   OR document LIKE 'SEED-ASS-%';

-- ---------- COMPRADORES (15) ----------
INSERT INTO clients
  (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, is_buyer, is_seller, is_assessor)
VALUES
  ('Ana Clara Mendes', 'CPF', 'SEED-COM-01', 'ana.mendes@email.ficticio', '11990010001', '11990010001', 'São Paulo', 'SP', 'Rua das Palmeiras, 101', 'Comprador fictício', 1, 1, 0, 0),
  ('Bruno Ferreira Costa', 'CPF', 'SEED-COM-02', 'bruno.costa@email.ficticio', '11990010002', '11990010002', 'Campinas', 'SP', 'Av. Brasil, 220', 'Comprador fictício', 1, 1, 0, 0),
  ('Camila Rocha Santos', 'CPF', 'SEED-COM-03', 'camila.santos@email.ficticio', '11990010003', '11990010003', 'Sorocaba', 'SP', 'Rua XV de Novembro, 45', 'Comprador fictício', 1, 1, 0, 0),
  ('Diego Almeida Pinto', 'CPF', 'SEED-COM-04', 'diego.pinto@email.ficticio', '21990010004', '21990010004', 'Rio de Janeiro', 'RJ', 'Rua do Catete, 88', 'Comprador fictício', 1, 1, 0, 0),
  ('Eduarda Nunes Lima', 'CPF', 'SEED-COM-05', 'eduarda.lima@email.ficticio', '31990010005', '31990010005', 'Belo Horizonte', 'MG', 'Av. Afonso Pena, 500', 'Comprador fictício', 1, 1, 0, 0),
  ('Felipe Barbosa Dias', 'CPF', 'SEED-COM-06', 'felipe.dias@email.ficticio', '41990010006', '41990010006', 'Curitiba', 'PR', 'Rua Marechal Deodoro, 12', 'Comprador fictício', 1, 1, 0, 0),
  ('Gabriela Souza Reis', 'CPF', 'SEED-COM-07', 'gabriela.reis@email.ficticio', '51990010007', '51990010007', 'Porto Alegre', 'RS', 'Av. Independência, 330', 'Comprador fictício', 1, 1, 0, 0),
  ('Henrique Lopes Araujo', 'CPF', 'SEED-COM-08', 'henrique.araujo@email.ficticio', '61990010008', '61990010008', 'Brasília', 'DF', 'SQN 202 Bloco A', 'Comprador fictício', 1, 1, 0, 0),
  ('Isabela Martins Cunha', 'CPF', 'SEED-COM-09', 'isabela.cunha@email.ficticio', '71990010009', '71990010009', 'Salvador', 'BA', 'Av. Sete de Setembro, 77', 'Comprador fictício', 1, 1, 0, 0),
  ('João Pedro Carvalho', 'CPF', 'SEED-COM-10', 'joao.carvalho@email.ficticio', '85990010010', '85990010010', 'Fortaleza', 'CE', 'Rua Barão do Rio Branco, 15', 'Comprador fictício', 1, 1, 0, 0),
  ('Karina Oliveira Freitas', 'CPF', 'SEED-COM-11', 'karina.freitas@email.ficticio', '81990010011', '81990010011', 'Recife', 'PE', 'Av. Boa Viagem, 900', 'Comprador fictício', 1, 1, 0, 0),
  ('Lucas Teixeira Ramos', 'CPF', 'SEED-COM-12', 'lucas.ramos@email.ficticio', '62990010012', '62990010012', 'Goiânia', 'GO', 'Rua 10, Qd. 15', 'Comprador fictício', 1, 1, 0, 0),
  ('Mariana Duarte Silva', 'CPF', 'SEED-COM-13', 'mariana.silva@email.ficticio', '48990010013', '48990010013', 'Florianópolis', 'SC', 'Rua Felipe Schmidt, 210', 'Comprador fictício', 1, 1, 0, 0),
  ('Nicolas Pires Andrade', 'CPF', 'SEED-COM-14', 'nicolas.andrade@email.ficticio', '92990010014', '92990010014', 'Manaus', 'AM', 'Av. Eduardo Ribeiro, 60', 'Comprador fictício', 1, 1, 0, 0),
  ('Olivia Castro Moreira', 'CPF', 'SEED-COM-15', 'olivia.moreira@email.ficticio', '67990010015', '67990010015', 'Campo Grande', 'MS', 'Rua 14 de Julho, 400', 'Comprador fictício', 1, 1, 0, 0);

-- ---------- VENDEDORES (15) ----------
INSERT INTO clients
  (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, is_buyer, is_seller, is_assessor)
VALUES
  ('Haras Serra Verde', 'CNPJ', 'SEED-VEN-01', 'contato@serraverde.ficticio', '1933012001', '19990020001', 'Itatiba', 'SP', 'Estrada Municipal km 8', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Boa Vista', 'CNPJ', 'SEED-VEN-02', 'contato@boavista.ficticio', '1933012002', '19990020002', 'Jundiaí', 'SP', 'Rod. Anhanguera km 55', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Três Pinheiros', 'CNPJ', 'SEED-VEN-03', 'contato@trespinheiros.ficticio', '1933012003', '19990020003', 'Bragança Paulista', 'SP', 'Estrada dos Pinheiros, s/n', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Vale do Sol', 'CNPJ', 'SEED-VEN-04', 'contato@valedosol.ficticio', '2133012004', '21990020004', 'Petrópolis', 'RJ', 'Estrada União Indústria, 1200', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Monte Alto', 'CNPJ', 'SEED-VEN-05', 'contato@montealto.ficticio', '3133012005', '31990020005', 'Araxá', 'MG', 'Fazenda Monte Alto', 'Vendedor fictício', 1, 0, 1, 0),
  ('Patricia Gomes Ribeiro', 'CPF', 'SEED-VEN-06', 'patricia.ribeiro@email.ficticio', '11990020006', '11990020006', 'São Paulo', 'SP', 'Rua Augusta, 1500', 'Vendedor fictício', 1, 0, 1, 0),
  ('Rafael Moura Batista', 'CPF', 'SEED-VEN-07', 'rafael.batista@email.ficticio', '19990020007', '19990020007', 'Piracicaba', 'SP', 'Av. Independência, 88', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Campo Limpo', 'CNPJ', 'SEED-VEN-08', 'contato@campolimpo.ficticio', '1633012008', '16990020008', 'Ribeirão Preto', 'SP', 'Rod. Anhanguera km 320', 'Vendedor fictício', 1, 0, 1, 0),
  ('Sérgio Antunes Prado', 'CPF', 'SEED-VEN-09', 'sergio.prado@email.ficticio', '41990020009', '41990020009', 'Curitiba', 'PR', 'Rua XV, 300', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Água Clara Seed', 'CNPJ', 'SEED-VEN-10', 'contato@aguaclaraseed.ficticio', '5133012010', '51990020010', 'Gramado', 'RS', 'RS-235 km 12', 'Vendedor fictício', 1, 0, 1, 0),
  ('Tatiana Melo Correia', 'CPF', 'SEED-VEN-11', 'tatiana.correia@email.ficticio', '61990020011', '61990020011', 'Brasília', 'DF', 'SHIS QI 15', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Estrela do Sul Seed', 'CNPJ', 'SEED-VEN-12', 'contato@estrelaseed.ficticio', '3433012012', '34990020012', 'Uberlândia', 'MG', 'Fazenda Estrela', 'Vendedor fictício', 1, 0, 1, 0),
  ('Vinícius Rocha Farias', 'CPF', 'SEED-VEN-13', 'vinicius.farias@email.ficticio', '71990020013', '71990020013', 'Salvador', 'BA', 'Av. Tancredo Neves, 50', 'Vendedor fictício', 1, 0, 1, 0),
  ('Haras Recanto Feliz', 'CNPJ', 'SEED-VEN-14', 'contato@recantofeliz.ficticio', '4833012014', '48990020014', 'Lages', 'SC', 'Estrada Geral, km 4', 'Vendedor fictício', 1, 0, 1, 0),
  ('Yasmin Cardoso Nogueira', 'CPF', 'SEED-VEN-15', 'yasmin.nogueira@email.ficticio', '85990020015', '85990020015', 'Fortaleza', 'CE', 'Av. Beira Mar, 2100', 'Vendedor fictício', 1, 0, 1, 0);

-- ---------- ASSESSORES (15) ----------
INSERT INTO clients
  (name, document_type, document, email, phone, whatsapp, city, state, address, notes, active, is_buyer, is_seller, is_assessor)
VALUES
  ('André Luiz Peixoto', 'CPF', 'SEED-ASS-01', 'andre.peixoto@email.ficticio', '11990030001', '11990030001', 'São Paulo', 'SP', 'Av. Paulista, 1000', 'Assessor fictício', 1, 0, 0, 1),
  ('Beatriz Campos Leal', 'CPF', 'SEED-ASS-02', 'beatriz.leal@email.ficticio', '11990030002', '11990030002', 'Campinas', 'SP', 'Rua Barão de Jaguara, 200', 'Assessor fictício', 1, 0, 0, 1),
  ('Carlos Eduardo Fontes', 'CPF', 'SEED-ASS-03', 'carlos.fontes@email.ficticio', '21990030003', '21990030003', 'Rio de Janeiro', 'RJ', 'Av. Rio Branco, 156', 'Assessor fictício', 1, 0, 0, 1),
  ('Daniela Vargas Monteiro', 'CPF', 'SEED-ASS-04', 'daniela.monteiro@email.ficticio', '31990030004', '31990030004', 'Belo Horizonte', 'MG', 'Rua da Bahia, 1100', 'Assessor fictício', 1, 0, 0, 1),
  ('Eduardo Siqueira Neto', 'CPF', 'SEED-ASS-05', 'eduardo.neto@email.ficticio', '41990030005', '41990030005', 'Curitiba', 'PR', 'Rua Comendador Araújo, 80', 'Assessor fictício', 1, 0, 0, 1),
  ('Fernanda Paiva Cruz', 'CPF', 'SEED-ASS-06', 'fernanda.cruz@email.ficticio', '51990030006', '51990030006', 'Porto Alegre', 'RS', 'Av. Borges de Medeiros, 400', 'Assessor fictício', 1, 0, 0, 1),
  ('Gustavo Henrique Tavares', 'CPF', 'SEED-ASS-07', 'gustavo.tavares@email.ficticio', '61990030007', '61990030007', 'Brasília', 'DF', 'SCLN 308', 'Assessor fictício', 1, 0, 0, 1),
  ('Helena Braga Figueiredo', 'CPF', 'SEED-ASS-08', 'helena.figueiredo@email.ficticio', '71990030008', '71990030008', 'Salvador', 'BA', 'Rua Chile, 25', 'Assessor fictício', 1, 0, 0, 1),
  ('Igor Santana Brito', 'CPF', 'SEED-ASS-09', 'igor.brito@email.ficticio', '85990030009', '85990030009', 'Fortaleza', 'CE', 'Av. Santos Dumont, 1500', 'Assessor fictício', 1, 0, 0, 1),
  ('Juliana Aparecida Mota', 'CPF', 'SEED-ASS-10', 'juliana.mota@email.ficticio', '81990030010', '81990030010', 'Recife', 'PE', 'Rua do Sol, 90', 'Assessor fictício', 1, 0, 0, 1),
  ('Kleber Augusto Diniz', 'CPF', 'SEED-ASS-11', 'kleber.diniz@email.ficticio', '62990030011', '62990030011', 'Goiânia', 'GO', 'Av. Goiás, 700', 'Assessor fictício', 1, 0, 0, 1),
  ('Larissa Helena Pacheco', 'CPF', 'SEED-ASS-12', 'larissa.pacheco@email.ficticio', '48990030012', '48990030012', 'Florianópolis', 'SC', 'Rua Conselheiro Mafra, 40', 'Assessor fictício', 1, 0, 0, 1),
  ('Marcelo Vieira Queiroz', 'CPF', 'SEED-ASS-13', 'marcelo.queiroz@email.ficticio', '92990030013', '92990030013', 'Manaus', 'AM', 'Av. Djalma Batista, 300', 'Assessor fictício', 1, 0, 0, 1),
  ('Natália Cristina Borges', 'CPF', 'SEED-ASS-14', 'natalia.borges@email.ficticio', '67990030014', '67990030014', 'Campo Grande', 'MS', 'Av. Afonso Pena, 2200', 'Assessor fictício', 1, 0, 0, 1),
  ('Otávio Renato Guimarães', 'CPF', 'SEED-ASS-15', 'otavio.guimaraes@email.ficticio', '95990030015', '95990030015', 'Boa Vista', 'RR', 'Av. Ville Roy, 100', 'Assessor fictício', 1, 0, 0, 1);
