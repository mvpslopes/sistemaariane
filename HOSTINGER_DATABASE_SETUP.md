# 🗄️ Configuração do Banco de Dados na Hostinger

Este guia explica como criar e configurar o banco de dados MySQL na Hostinger para o sistema.

## 📋 Passo 1: Criar o Banco de Dados na Hostinger

### 1.1 Acessar o Painel de Controle

1. Acesse o **hPanel** da Hostinger (https://hpanel.hostinger.com/)
2. Faça login com suas credenciais
3. Selecione seu domínio/hospedagem

### 1.2 Criar o Banco de Dados

1. No menu lateral, procure por **"Bancos de Dados"** ou **"Databases"**
2. Clique em **"MySQL Databases"** ou **"Criar Banco de Dados"**
3. Preencha os dados:

   **Nome do Banco de Dados:**
   ```
   sistema_ariane
   ```
   ou
   ```
   ariane_sistema
   ```
   
   **Nome de Usuário:**
   ```
   ariane_user
   ```
   ou use o padrão gerado pela Hostinger
   
   **Senha:**
   - Crie uma senha forte (anote em local seguro!)
   - Use o gerador de senhas da Hostinger se preferir

4. Clique em **"Criar"** ou **"Adicionar"**

### 1.3 Anotar as Informações

Após criar, você receberá:
- **Nome do Banco:** `seu_usuario_sistema_ariane` (geralmente com prefixo)
- **Usuário:** `seu_usuario_ariane_user`
- **Senha:** (a que você criou)
- **Host:** `localhost` (geralmente)
- **Porta:** `3306` (padrão MySQL)

**⚠️ IMPORTANTE:** Anote todas essas informações! Você precisará delas.

## 📋 Passo 2: Criar as Tabelas

### 2.1 Acessar o phpMyAdmin

1. No hPanel, procure por **"phpMyAdmin"**
2. Clique para abrir
3. Selecione o banco de dados que você criou

### 2.2 Executar o SQL

1. Clique na aba **"SQL"**
2. Cole o seguinte código SQL:

```sql
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabela de registros diários
CREATE TABLE IF NOT EXISTS `daily_reports` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `data` DATE NOT NULL,
  `colaboradora` VARCHAR(100) NOT NULL,
  `num_atendimentos` VARCHAR(50) NOT NULL,
  `todos_clientes_respondidos` BOOLEAN DEFAULT TRUE,
  `clientes_pendentes` TEXT,
  `cliente_irritado` BOOLEAN DEFAULT FALSE,
  `cobranca_indevida` BOOLEAN DEFAULT FALSE,
  `questionamento_financeiro` BOOLEAN DEFAULT FALSE,
  `contestacao_regras` BOOLEAN DEFAULT FALSE,
  `escalado_gestao` BOOLEAN DEFAULT FALSE,
  `nenhuma_critica` BOOLEAN DEFAULT TRUE,
  `suporte_gestao` BOOLEAN DEFAULT FALSE,
  `suporte_colegas` BOOLEAN DEFAULT FALSE,
  `motivo_suporte` TEXT,
  `autoavaliacao` VARCHAR(50) NOT NULL,
  `compromissos_amanha` TEXT,
  `declaracao` BOOLEAN DEFAULT FALSE,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_colaboradora` (`colaboradora`),
  INDEX `idx_data` (`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserir usuários iniciais
INSERT INTO `users` (`name`, `email`, `password`) VALUES
('Ariane', 'ariane@assessoria.com', 'ariane123'),
('Amanda', 'amanda@assessoria.com', 'amanda123'),
('Tayná', 'tayna@assessoria.com', 'tayna123'),
('Thauana', 'thauana@assessoria.com', 'thauana123'),
('Marcella', 'marcella@assessoria.com', 'marcella123'),
('Erika', 'erika@assessoria.com', 'erika123'),
('Michelle', 'michelle@assessoria.com', 'michelle123')
ON DUPLICATE KEY UPDATE name=name;
```

3. Clique em **"Executar"** ou **"Go"**

### 2.3 Verificar

1. Verifique se as tabelas foram criadas:
   - `users` (7 registros)
   - `daily_reports` (vazia por enquanto)

## 📋 Passo 3: Configurar o Backend

O backend será criado na pasta `backend/` do projeto. Veja o arquivo `BACKEND_SETUP.md` para instruções detalhadas.

## 📋 Resumo das Informações Necessárias

Após criar o banco, você terá:

```
Host: localhost
Porta: 3306
Banco: seu_usuario_sistema_ariane
Usuário: seu_usuario_ariane_user
Senha: [sua senha]
```

Essas informações serão usadas no arquivo `.env` do backend.

## ⚠️ Importante

- **Segurança:** Em produção, altere as senhas dos usuários e use hash (bcrypt)
- **Backup:** Configure backups regulares no hPanel
- **Permissões:** O usuário do banco precisa ter permissões de SELECT, INSERT, UPDATE

## 🆘 Problemas Comuns

### Erro: "Access denied"
- Verifique usuário e senha
- Verifique se o usuário tem permissões no banco

### Erro: "Table already exists"
- As tabelas já existem, pode ignorar
- Ou exclua e recrie se necessário

### Não encontro phpMyAdmin
- Alguns planos da Hostinger usam interface diferente
- Procure por "MySQL" ou "Database Manager"
- Ou use um cliente MySQL externo (MySQL Workbench, DBeaver)

