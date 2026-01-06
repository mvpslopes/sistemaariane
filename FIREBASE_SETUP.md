# 🔥 Configuração do Firebase

Este guia explica como configurar o Firebase Firestore para o sistema funcionar com banco de dados real.

## 📋 Pré-requisitos

- Conta Google (gratuita)
- Acesso à internet

## 🚀 Passo a Passo

### 1. Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto" ou "Create a project"
3. Digite o nome do projeto (ex: "SistemaAriane")
4. Desative o Google Analytics (opcional) ou mantenha ativado
5. Clique em "Criar projeto"

### 2. Ativar Firestore Database

1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Começar no modo de teste"** (para desenvolvimento)
4. Selecione a localização (escolha a mais próxima do Brasil, ex: `southamerica-east1`)
5. Clique em **"Ativar"**

### 3. Configurar Regras de Segurança

1. Vá em **"Regras"** (Rules) no Firestore
2. Cole as seguintes regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura e escrita para usuários autenticados
    // Por enquanto, permitir acesso público (ajuste conforme necessário)
    match /dailyReports/{document=**} {
      allow read, write: if true;
    }
    
    // Para produção, use autenticação:
    // match /dailyReports/{document=**} {
    //   allow read, write: if request.auth != null;
    // }
  }
}
```

3. Clique em **"Publicar"**

### 4. Obter Credenciais do Firebase

1. Vá em **"Configurações do projeto"** (ícone de engrenagem)
2. Role até **"Seus aplicativos"** (Your apps)
3. Clique no ícone **"Web"** (`</>`)
4. Registre o app com um nome (ex: "Sistema Interno")
5. **Copie as credenciais** que aparecem

### 5. Configurar Variáveis de Ambiente

1. Na raiz do projeto, crie um arquivo `.env` (copie do `.env.example`)
2. Cole as credenciais do Firebase:

```env
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

3. Salve o arquivo

### 6. Testar a Conexão

1. Execute o projeto:
   ```bash
   npm run dev
   ```

2. Faça login no sistema
3. Crie um registro diário
4. Verifique no Firebase Console se o registro foi salvo em **Firestore Database > dailyReports**

## 🔒 Segurança (Importante para Produção)

### Regras Recomendadas para Produção

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dailyReports/{documentId} {
      // Permitir leitura para todos os usuários autenticados
      allow read: if request.auth != null;
      
      // Permitir escrita apenas se o usuário estiver autenticado
      // e o campo colaboradora corresponder ao nome do usuário
      allow create: if request.auth != null 
        && request.resource.data.colaboradora == request.auth.token.name;
      
      // Permitir atualização apenas pelo próprio autor
      allow update, delete: if request.auth != null 
        && resource.data.colaboradora == request.auth.token.name;
    }
  }
}
```

**Nota:** Para usar essas regras, você precisará implementar autenticação do Firebase (opcional).

## 📊 Estrutura dos Dados

Os registros são salvos na coleção `dailyReports` com a seguinte estrutura:

```javascript
{
  data: "01/01/2024",
  colaboradora: "Ariane",
  numAtendimentos: "11 a 20",
  todosClientesRespondidos: true,
  clientesPendentes: "",
  ocorrencias: {
    clienteIrritado: false,
    cobrancaIndevida: false,
    questionamentoFinanceiro: false,
    contestacaoRegras: false,
    escaladoGestao: false,
    nenhumaCritica: true
  },
  suporteGestao: false,
  suporteColegas: false,
  motivoSuporte: "",
  autoavaliacao: "Bom",
  compromissosAmanha: "",
  declaracao: true,
  timestamp: Timestamp,
  createdAt: Timestamp
}
```

## 🔄 Fallback para localStorage

Se o Firebase não estiver configurado ou houver erro de conexão, o sistema automaticamente usa o `localStorage` como fallback. Isso garante que o sistema sempre funcione, mesmo sem internet.

## 💰 Custos

O Firebase tem um plano **gratuito generoso**:
- 50.000 leituras/dia
- 20.000 escritas/dia
- 20.000 exclusões/dia
- 1 GB de armazenamento

Para a maioria dos casos de uso, o plano gratuito é suficiente.

## 🐛 Troubleshooting

### Erro: "Firebase não configurado"
- Verifique se o arquivo `.env` existe e está na raiz do projeto
- Verifique se todas as variáveis começam com `VITE_`
- Reinicie o servidor de desenvolvimento após criar/editar o `.env`

### Erro: "Permission denied"
- Verifique as regras do Firestore
- Certifique-se de que as regras permitem leitura/escrita

### Dados não aparecem
- Verifique o console do navegador para erros
- Verifique no Firebase Console se os dados foram salvos
- Limpe o cache do navegador

## 📝 Próximos Passos

1. ✅ Configurar Firebase
2. ⏭️ Testar salvamento de registros
3. ⏭️ Verificar sincronização
4. ⏭️ (Opcional) Implementar autenticação Firebase para maior segurança

