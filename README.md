# 🔐 Sistema Interno - Registro Diário de Atendimento

Sistema standalone para registro diário de atendimento ao cliente, desenvolvido para ser hospedado em um domínio separado.

## 📋 Características

- ✅ Sistema de autenticação completo
- ✅ Dashboard com estatísticas e histórico
- ✅ Formulário completo de registro diário
- ✅ Exportação para Excel (apenas para Ariane)
- ✅ Armazenamento local (localStorage) ou Google Sheets
- ✅ Interface moderna e responsiva
- ✅ Tela de login personalizada

## 🚀 Instalação

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente (opcional)

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/SEU_SCRIPT_ID/exec
```

> **Nota:** Se não configurar, o sistema funcionará apenas com armazenamento local (localStorage).

### 3. Executar em desenvolvimento

```bash
npm run dev
```

### 4. Build para produção

```bash
npm run build
```

Os arquivos estarão na pasta `dist/`.

## 👥 Usuários do Sistema

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

> **Importante:** Em produção, altere as senhas e implemente criptografia adequada.

## 📁 Estrutura do Projeto

```
sistema-interno-standalone/
├── src/
│   ├── components/
│   │   └── ProtectedRoute.tsx    # Proteção de rotas
│   ├── contexts/
│   │   └── AuthContext.tsx       # Contexto de autenticação
│   ├── pages/
│   │   ├── Login.tsx              # Tela de login
│   │   ├── Dashboard.tsx          # Dashboard principal
│   │   └── DailyReportForm.tsx    # Formulário de registro
│   ├── services/
│   │   └── dailyReportService.ts  # Serviço de salvamento
│   ├── App.tsx                    # Componente principal
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Estilos globais
├── public/
│   └── logo.png                   # Logo (opcional)
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🔒 Rotas

- `/` - Tela de login (redireciona se não autenticado)
- `/dashboard` - Dashboard principal (protegido)
- `/registro` - Formulário de registro (protegido)

## 💾 Armazenamento de Dados

### Modo Local (Padrão)
- Dados salvos no `localStorage` do navegador
- Cada colaboradora vê apenas seus próprios registros
- Ariane vê todos os registros e pode exportar

### Modo Google Sheets (Opcional)
- Configure `VITE_GOOGLE_SCRIPT_URL` no `.env`
- Veja `GOOGLE_APPS_SCRIPT.md` para instruções de configuração
- Os dados serão salvos tanto no Google Sheets quanto no localStorage (backup)

## 🎨 Personalização

### Logo
Substitua o arquivo `public/logo.png` pelo seu logo personalizado.

### Cores
Edite `tailwind.config.js` para alterar as cores da marca:

```js
colors: {
  brand: {
    brown: '#81705F',
    beige: '#E6D8C3',
    'off-white': '#F8F7F4',
    olive: '#A0896A',
  },
}
```

### Tela de Login
Edite `src/pages/Login.tsx` para personalizar a tela de login.

## 📦 Deploy

### Vercel / Netlify
1. Conecte o repositório
2. Configure a variável de ambiente `VITE_GOOGLE_SCRIPT_URL` (se necessário)
3. Deploy automático

### Hostinger / Hospedagem Tradicional
1. Execute `npm run build`
2. Faça upload da pasta `dist/` para o servidor
3. Configure o servidor para servir `index.html` em todas as rotas (SPA)

## 🔧 Troubleshooting

### Erro ao fazer login
- Verifique se está usando o email e senha corretos
- Os emails são case-insensitive
- As senhas são case-sensitive

### Registros não aparecem
- Verifique se está logada com a conta correta
- Limpe o cache do navegador se necessário
- Verifique o console do navegador para erros

### Erro ao exportar Excel
- Verifique se está logada como Ariane
- Verifique se o navegador permite downloads
- Verifique o console para erros

## 📝 Notas Importantes

- ⚠️ **Em produção**, implemente criptografia de senhas (hash)
- ⚠️ **Em produção**, considere autenticação mais robusta (JWT, OAuth)
- ⚠️ **Em produção**, considere usar um banco de dados real
- ✅ O sistema atual é funcional para **demonstração e uso interno**
- ✅ Todos os dados são salvos localmente como backup

## 📄 Licença

Uso interno - Todos os direitos reservados.

