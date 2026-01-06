# 🚀 Deploy em Produção - Hostinger

Este guia explica como fazer o deploy completo do sistema na Hostinger com banco de dados MySQL.

## 📋 Opções de Deploy

A Hostinger oferece duas opções principais:

### Opção 1: PHP (Recomendado - Mais Simples) ✅
- **Vantagem:** Todos os planos da Hostinger suportam PHP
- **Arquivo:** `backend/api.php`
- **Não precisa:** Node.js instalado
- **Mais fácil:** Apenas fazer upload do arquivo

### Opção 2: Node.js (Se disponível)
- **Vantagem:** Mais moderno
- **Arquivo:** `backend/server.js`
- **Requisito:** Plano que suporte Node.js
- **Mais complexo:** Precisa configurar PM2 ou similar

## 🎯 Opção 1: Deploy com PHP (Recomendado)

### Passo 1: Configurar o arquivo PHP

1. Abra o arquivo `backend/api.php`
2. **IMPORTANTE:** Atualize as credenciais do banco nas linhas 12-16:

```php
$db_host = 'localhost';
$db_port = 3306;
$db_user = 'u179630068_ariane_user';  // Seu usuário
$db_password = '6hA;F:&u9vA';          // Sua senha
$db_name = 'u179630068_sistema_ariane'; // Seu banco
```

### Passo 2: Fazer Upload

1. Acesse o **File Manager** da Hostinger
2. Vá para a pasta do seu domínio (geralmente `public_html`)
3. Crie uma pasta `api` (ou use outra pasta)
4. Faça upload do arquivo `backend/api.php` para essa pasta

**Estrutura final:**
```
public_html/
├── index.html (frontend)
├── assets/ (frontend)
└── api/
    └── api.php
```

### Passo 3: Configurar o Frontend

1. No arquivo `.env` do frontend (ou nas variáveis de ambiente), configure:

```env
VITE_API_URL=https://seu-dominio.com/api
```

2. Ou se estiver em subpasta:
```env
VITE_API_URL=https://seu-dominio.com/pasta/api
```

### Passo 4: Testar

1. Acesse: `https://seu-dominio.com/api/api.php/health`
2. Deve retornar: `{"status":"ok","database":"connected"}`

## 🎯 Opção 2: Deploy com Node.js

### Passo 1: Verificar Suporte

1. Acesse o hPanel
2. Procure por "Node.js" ou "Node.js App"
3. Se não encontrar, use a **Opção 1 (PHP)**

### Passo 2: Configurar

1. Faça upload da pasta `backend/` completa
2. Configure o arquivo `.env` no servidor
3. Instale dependências: `npm install --production`
4. Inicie com PM2: `pm2 start server.js --name sistema-ariane`

## 🔧 Configuração do Frontend

### Arquivo `.env` (ou variáveis de ambiente)

```env
# URL da API em produção
VITE_API_URL=https://seu-dominio.com/api

# Ou se usar Node.js em porta específica:
# VITE_API_URL=https://seu-dominio.com:3000/api
```

### Build do Frontend

1. Configure o `.env` com a URL correta
2. Execute: `npm run build`
3. Faça upload da pasta `dist/` para `public_html/`

## ✅ Checklist de Deploy

- [ ] Banco de dados MySQL criado
- [ ] Tabelas criadas (users e daily_reports)
- [ ] Usuários inseridos na tabela users
- [ ] Arquivo `api.php` configurado com credenciais corretas
- [ ] Arquivo `api.php` enviado para o servidor
- [ ] Frontend configurado com `VITE_API_URL` correto
- [ ] Frontend buildado e enviado
- [ ] Testado endpoint `/api/api.php/health`
- [ ] Testado login no sistema
- [ ] Testado criação de registro

## 🧪 Testar em Produção

### 1. Testar Health Check
```
https://seu-dominio.com/api/api.php/health
```

### 2. Testar Login
Use o Postman ou curl:
```bash
curl -X POST https://seu-dominio.com/api/api.php/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ariane@assessoria.com","password":"ariane123"}'
```

### 3. Testar no Sistema
1. Acesse o site
2. Faça login
3. Crie um registro
4. Verifique se foi salvo no banco

## ⚠️ Problemas Comuns

### Erro 500 no PHP
- Verifique as credenciais do banco no `api.php`
- Verifique se as tabelas existem
- Veja os logs de erro do PHP

### CORS Error
- O arquivo `api.php` já tem CORS configurado
- Se persistir, verifique se está acessando pelo domínio correto

### Rota não encontrada
- Certifique-se de que a URL está correta
- Para PHP: `https://dominio.com/api/api.php/health`
- Para Node.js: `https://dominio.com/api/health`

## 📝 Estrutura Final Recomendada

```
public_html/
├── index.html
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
├── logo-ariane-andrade.png
├── logo-ariane-wide.png
├── .htaccess
└── api/
    └── api.php
```

## 🎉 Pronto!

Após seguir estes passos, seu sistema estará funcionando em produção com banco de dados MySQL real!

