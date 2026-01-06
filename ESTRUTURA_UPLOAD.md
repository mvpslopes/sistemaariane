# 📁 Estrutura de Upload - Hostinger

Este guia mostra exatamente onde colocar cada arquivo na Hostinger.

## 🗂️ Estrutura de Pastas na Hostinger

### Opção 1: Site na Raiz do Domínio (Recomendado)

Se seu site está em `https://meusite.com`, a estrutura será:

```
public_html/
├── index.html                    ← Frontend (página principal)
├── assets/                       ← Frontend (JS e CSS)
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
├── logo-ariane-andrade.png       ← Logo splash screen
├── logo-ariane-wide.png          ← Logo login
├── .htaccess                     ← Configuração SPA
└── api/                          ← Backend PHP
    └── api.php                   ← API do sistema
```

### Opção 2: Site em Subpasta

Se seu site está em `https://meusite.com/sistema`, a estrutura será:

```
public_html/
└── sistema/
    ├── index.html
    ├── assets/
    ├── logo-ariane-andrade.png
    ├── logo-ariane-wide.png
    ├── .htaccess
    └── api/
        └── api.php
```

## 📤 Passo a Passo do Upload

### 1. Acessar o File Manager

1. Acesse o **hPanel** da Hostinger
2. Procure por **"File Manager"** ou **"Gerenciador de Arquivos"**
3. Clique para abrir

### 2. Navegar para a Pasta Correta

- Se o site está na raiz: vá para `public_html/`
- Se o site está em subpasta: vá para `public_html/sua-pasta/`

### 3. Upload do Frontend (Pasta `dist/`)

1. **Selecione todos os arquivos** da pasta `dist/` do seu computador:
   - `index.html`
   - Pasta `assets/` completa
   - `logo-ariane-andrade.png`
   - `logo-ariane-wide.png`
   - `.htaccess`

2. **Faça upload** para `public_html/` (ou subpasta)

### 4. Criar Pasta `api/` e Upload do Backend

1. **Criar a pasta:**
   - No File Manager, clique em **"Nova Pasta"** ou **"New Folder"**
   - Nome: `api`
   - Criar dentro de `public_html/`

2. **Upload do arquivo PHP:**
   - Entre na pasta `api/` que você criou
   - Faça upload do arquivo `backend/api.php`
   - O caminho final será: `public_html/api/api.php`

## 📍 Caminhos Finais

### Frontend
- **URL:** `https://seu-dominio.com/`
- **Arquivo principal:** `public_html/index.html`

### Backend API
- **URL:** `https://seu-dominio.com/api/api.php/health`
- **Arquivo:** `public_html/api/api.php`

## ⚙️ Configuração do Frontend

No arquivo `.env` do frontend (antes do build), configure:

```env
VITE_API_URL=https://seu-dominio.com/api
```

**Importante:** A URL deve apontar para a pasta `api/`, não para o arquivo `api.php` diretamente.

O sistema automaticamente adiciona `/api.php` nas rotas.

## 🔍 Verificar se Está Correto

Após o upload, verifique:

1. **Frontend:**
   - Acesse: `https://seu-dominio.com/`
   - Deve abrir a tela de login

2. **Backend:**
   - Acesse: `https://seu-dominio.com/api/api.php/health`
   - Deve retornar: `{"status":"ok","database":"connected"}`

## 📝 Exemplo Visual

```
File Manager - public_html/
│
├── 📄 index.html
├── 📁 assets/
│   ├── 📄 index-20qr8LBV.js
│   └── 📄 index-CL9FSMlD.css
├── 🖼️ logo-ariane-andrade.png
├── 🖼️ logo-ariane-wide.png
├── 📄 .htaccess
└── 📁 api/
    └── 📄 api.php  ← Backend aqui!
```

## ⚠️ Importante

- **Não coloque** o arquivo `api.php` na raiz junto com `index.html`
- **Sempre crie** a pasta `api/` primeiro
- O arquivo `.htaccess` deve estar na mesma pasta do `index.html`
- Certifique-se de que o arquivo `api.php` tem as credenciais corretas do banco

## 🆘 Problemas Comuns

### Erro 404 ao acessar API
- Verifique se a pasta `api/` existe
- Verifique se o arquivo `api.php` está dentro da pasta `api/`
- Verifique o caminho: `public_html/api/api.php`

### Frontend não encontra a API
- Verifique se `VITE_API_URL` está correto no `.env`
- Faça um novo build após alterar o `.env`
- Verifique se a URL não tem barra no final: `https://dominio.com/api` (sem `/` no final)

