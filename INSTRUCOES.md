# 📋 Instruções para o Desenvolvedor

Este documento contém instruções específicas para o desenvolvedor que irá fazer o deploy do sistema interno.

## 📦 O que está incluído

Este projeto contém um sistema completo e standalone para registro diário de atendimento ao cliente. O sistema está **100% funcional** e pode ser usado imediatamente após a instalação.

## 🚀 Passos para Iniciar

### 1. Instalar Dependências

```bash
cd sistema-interno-standalone
npm install
```

### 2. Executar em Desenvolvimento

```bash
npm run build
```

### 3. Testar Localmente

```bash
npm run preview
```

Acesse `http://localhost:4173` para testar.

## 📁 Estrutura do Projeto

```
sistema-interno-standalone/
├── src/
│   ├── components/        # Componentes reutilizáveis
│   ├── contexts/          # Context API (autenticação)
│   ├── pages/             # Páginas do sistema
│   ├── services/          # Serviços (salvamento de dados)
│   ├── App.tsx            # Componente principal
│   ├── main.tsx           # Entry point
│   └── index.css          # Estilos globais
├── public/                # Arquivos estáticos
├── dist/                  # Build de produção (gerado)
├── package.json           # Dependências
├── vite.config.ts         # Configuração do Vite
├── tailwind.config.js     # Configuração do Tailwind
└── README.md              # Documentação completa
```

## 🔐 Credenciais de Acesso

O sistema possui 7 usuários pré-configurados:

| Nome | Email | Senha |
|------|-------|-------|
| Ariane | ariane@assessoria.com | ariane123 |
| Amanda | amanda@assessoria.com | amanda123 |
| Tayná | tayna@assessoria.com | tayna123 |
| Thauana | thauana@assessoria.com | thauana123 |
| Marcella | marcella@assessoria.com | marcella123 |
| Erika | erika@assessoria.com | erika123 |
| Michelle | michelle@assessoria.com | michelle123 |

> **Importante:** Apenas **Ariane** tem permissão para exportar todos os registros para Excel.

## 🌐 Rotas do Sistema

- `/` - Tela de login (página inicial)
- `/dashboard` - Dashboard principal (requer autenticação)
- `/registro` - Formulário de registro (requer autenticação)

## 💾 Armazenamento de Dados

### Modo Padrão (LocalStorage)
- Os dados são salvos no navegador do usuário
- Funciona completamente offline
- Cada colaboradora vê apenas seus próprios registros
- Ariane vê todos os registros

### Modo Google Sheets (Opcional)
- Configure `VITE_GOOGLE_SCRIPT_URL` no `.env`
- Veja `GOOGLE_APPS_SCRIPT.md` para instruções
- Os dados são salvos tanto no Google Sheets quanto no localStorage (backup)

## 🎨 Personalização

### Alterar Logo
1. Adicione sua logo em `public/logo.png`
2. Edite `src/pages/Login.tsx` linha 44-48 para usar a imagem

### Alterar Cores
Edite `tailwind.config.js` na seção `colors.brand`

### Alterar Título
Edite `index.html` na tag `<title>`

## 📤 Deploy

### Opção 1: Vercel (Recomendado - Grátis)

1. Instale a CLI da Vercel:
   ```bash
   npm i -g vercel
   ```

2. Faça login:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Configure variáveis de ambiente (se necessário):
   - Acesse o dashboard da Vercel
   - Adicione `VITE_GOOGLE_SCRIPT_URL` se quiser usar Google Sheets

### Opção 2: Netlify

1. Instale a CLI do Netlify:
   ```bash
   npm i -g netlify-cli
   ```

2. Build e deploy:
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

### Opção 3: Hostinger / FTP

1. Build:
   ```bash
   npm run build
   ```

2. Faça upload da pasta `dist/` para o servidor

3. Crie um arquivo `.htaccess` na raiz com:
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

## ⚙️ Configurações Importantes

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz (ou configure na plataforma de deploy):

```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/SEU_SCRIPT_ID/exec
```

> **Nota:** Se não configurar, o sistema funcionará apenas com localStorage.

### Configuração do Servidor (SPA)

O sistema é uma Single Page Application (SPA), então **todas as rotas devem redirecionar para `index.html`**.

**Apache (.htaccess):**
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

**Nginx:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## 🐛 Problemas Comuns

### Página em branco após deploy
- Verifique se o servidor está configurado para SPA
- Verifique o console do navegador para erros
- Verifique se todos os arquivos foram enviados

### Erro 404 em rotas
- Configure o servidor para redirecionar todas as rotas para `index.html`
- Veja a seção "Configuração do Servidor (SPA)" acima

### Dados não salvam
- Verifique se o localStorage está habilitado
- Verifique o console para erros
- Se usando Google Sheets, verifique a URL do script

## 📝 Checklist de Deploy

- [ ] Instalar dependências (`npm install`)
- [ ] Testar localmente (`npm run build && npm run preview`)
- [ ] Configurar variáveis de ambiente (se necessário)
- [ ] Fazer build (`npm run build`)
- [ ] Fazer upload da pasta `dist/`
- [ ] Configurar servidor para SPA (`.htaccess` ou Nginx)
- [ ] Testar login com uma das credenciais
- [ ] Testar criação de registro
- [ ] Testar exportação Excel (como Ariane)

## 📞 Suporte

Para dúvidas, consulte:
- `README.md` - Documentação completa
- `SETUP.md` - Guia de setup detalhado
- `GOOGLE_APPS_SCRIPT.md` - Configuração do Google Sheets (se aplicável)

## ✅ Sistema Pronto para Uso

O sistema está **100% funcional** e pronto para uso. Não são necessárias configurações adicionais para funcionar em modo básico (localStorage).

Boa sorte com o deploy! 🚀

