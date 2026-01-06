# 🚀 Guia de Setup - Sistema Interno Standalone

Este guia explica como configurar e fazer o deploy do sistema interno em um domínio separado.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Acesso ao servidor de hospedagem
- Domínio configurado (opcional)

## 🔧 Instalação Local

### 1. Navegar para a pasta do projeto

```bash
cd sistema-interno-standalone
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Executar em desenvolvimento

```bash
npm run dev
```

O sistema estará disponível em `http://localhost:5173`

## 🏗️ Build para Produção

### 1. Criar build de produção

```bash
npm run build
```

Isso criará uma pasta `dist/` com os arquivos otimizados.

### 2. Testar o build localmente

```bash
npm run preview
```

## 📤 Deploy

### Opção 1: Vercel / Netlify (Recomendado)

1. **Conectar repositório:**
   - Faça push do código para GitHub/GitLab
   - Conecte o repositório na Vercel ou Netlify

2. **Configurar variáveis de ambiente (opcional):**
   - Na dashboard da Vercel/Netlify
   - Adicione `VITE_GOOGLE_SCRIPT_URL` se quiser usar Google Sheets

3. **Deploy automático:**
   - O deploy será feito automaticamente a cada push

### Opção 2: Hostinger / Hospedagem Tradicional

1. **Fazer upload dos arquivos:**
   - Execute `npm run build`
   - Faça upload da pasta `dist/` para o servidor via FTP

2. **Configurar servidor (Apache):**
   - Crie um arquivo `.htaccess` na pasta raiz com:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

3. **Configurar variáveis de ambiente:**
   - Se necessário, configure no painel da hospedagem
   - Ou edite o código para usar valores fixos (não recomendado)

### Opção 3: Servidor próprio (Node.js)

1. **Instalar servidor estático:**
   ```bash
   npm install -g serve
   ```

2. **Servir a pasta dist:**
   ```bash
   serve -s dist -l 3000
   ```

3. **Configurar proxy reverso (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🔐 Configuração de Usuários

Para alterar os usuários do sistema, edite o arquivo:

```
src/contexts/AuthContext.tsx
```

Localize a constante `USERS` e modifique conforme necessário:

```typescript
const USERS: User[] = [
  { id: '1', name: 'Ariane', email: 'ariane@assessoria.com', password: 'ariane123' },
  // Adicione mais usuários aqui
];
```

> **⚠️ IMPORTANTE:** Em produção, implemente criptografia de senhas (hash) e autenticação mais robusta.

## 📊 Integração com Google Sheets (Opcional)

1. **Criar Google Sheet:**
   - Crie uma planilha no Google Drive
   - Adicione as colunas necessárias

2. **Criar Google Apps Script:**
   - Veja o arquivo `GOOGLE_APPS_SCRIPT.md` para instruções detalhadas
   - Publique como Web App

3. **Configurar variável de ambiente:**
   - Adicione `VITE_GOOGLE_SCRIPT_URL` no `.env` (desenvolvimento)
   - Ou configure na plataforma de deploy (produção)

## 🎨 Personalização

### Logo

Substitua o ícone na tela de login editando `src/pages/Login.tsx`:

```tsx
// Adicione uma imagem no public/logo.png
<img src="/logo.png" alt="Logo" className="h-16" />
```

### Cores

Edite `tailwind.config.js` para alterar as cores:

```js
colors: {
  brand: {
    brown: '#81705F',      // Cor principal
    beige: '#E6D8C3',      // Cor de fundo
    'off-white': '#F8F7F4', // Cor secundária
    olive: '#A0896A',      // Cor de destaque
  },
}
```

### Título e Descrição

Edite `index.html` para alterar o título e descrição da página.

## 🐛 Troubleshooting

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Verifique se todas as dependências estão no `package.json`

### Erro: "Port already in use"
- Altere a porta no `vite.config.ts`:
  ```ts
  export default defineConfig({
    server: {
      port: 3001
    }
  });
  ```

### Página em branco após deploy
- Verifique se o servidor está configurado para servir `index.html` em todas as rotas (SPA)
- Verifique o console do navegador para erros

### Dados não salvam
- Verifique se o `localStorage` está habilitado no navegador
- Verifique se há erros no console
- Se usando Google Sheets, verifique a URL do script

## 📝 Notas Finais

- ✅ O sistema funciona completamente offline (localStorage)
- ✅ Google Sheets é opcional
- ✅ Todos os dados são salvos localmente como backup
- ⚠️ Em produção, considere implementar autenticação mais robusta
- ⚠️ Em produção, considere usar um banco de dados real

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- `README.md` - Documentação geral
- `GOOGLE_APPS_SCRIPT.md` - Configuração do Google Sheets

