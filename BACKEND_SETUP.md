# 🔧 Configuração do Backend

Este guia explica como configurar e fazer deploy do backend na Hostinger.

## 📋 Pré-requisitos

- Banco de dados MySQL criado na Hostinger (veja `HOSTINGER_DATABASE_SETUP.md`)
- Node.js instalado localmente (para testar)
- Acesso SSH ou File Manager na Hostinger

## 🚀 Passo 1: Configurar Localmente (Teste)

### 1.1 Instalar Dependências

```bash
cd backend
npm install
```

### 1.2 Configurar Variáveis de Ambiente

1. Copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edite o arquivo `.env` com suas credenciais do banco:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario_ariane_user
DB_PASSWORD=sua_senha_aqui
DB_NAME=seu_usuario_sistema_ariane
PORT=3000
```

### 1.3 Testar Localmente

```bash
npm start
```

Acesse: http://localhost:3000/api/health

Se retornar `{"status":"ok","database":"connected"}`, está funcionando!

## 🚀 Passo 2: Deploy na Hostinger

### Opção A: Usando Node.js (se disponível)

1. **Fazer upload dos arquivos:**
   - Faça upload da pasta `backend/` para seu servidor
   - Exemplo: `/home/usuario/public_html/api/` ou `/home/usuario/api/`

2. **Instalar dependências no servidor:**
   ```bash
   cd /caminho/para/backend
   npm install --production
   ```

3. **Configurar `.env`:**
   - Crie o arquivo `.env` no servidor com as credenciais

4. **Iniciar o servidor:**
   - Use PM2 ou similar para manter o servidor rodando:
   ```bash
   npm install -g pm2
   pm2 start server.js --name sistema-ariane
   pm2 save
   pm2 startup
   ```

### Opção B: Usando PHP (Alternativa Simples)

Se a Hostinger não suportar Node.js, use a versão PHP (veja `backend/api.php`).

## 🔗 Passo 3: Configurar o Frontend

Atualize o arquivo `.env` do frontend:

```env
VITE_API_URL=https://seu-dominio.com/api
```

Ou se estiver na mesma hospedagem:

```env
VITE_API_URL=http://localhost:3000/api
```

## 📝 Estrutura de Arquivos

```
backend/
├── server.js          # Servidor Node.js
├── package.json       # Dependências
├── .env              # Configurações (não commitar!)
└── .env.example      # Exemplo de configuração
```

## 🧪 Testar as Rotas

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ariane@assessoria.com","password":"ariane123"}'
```

### Listar Registros
```bash
curl http://localhost:3000/api/reports
```

### Criar Registro
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "data": "01/01/2024",
    "colaboradora": "Ariane",
    "numAtendimentos": "11 a 20",
    "autoavaliacao": "Bom",
    "declaracao": true
  }'
```

## ⚠️ Importante

- **Segurança:** Em produção, use HTTPS
- **CORS:** Configure CORS adequadamente para seu domínio
- **Senhas:** Implemente hash de senhas (bcrypt) em produção
- **Validação:** Adicione validação de dados nas rotas

## 🆘 Problemas Comuns

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Verifique se está na pasta correta

### Erro: "Access denied" no banco
- Verifique credenciais no `.env`
- Verifique se o usuário tem permissões

### Porta já em uso
- Altere a porta no `.env`
- Ou pare o processo que está usando a porta

