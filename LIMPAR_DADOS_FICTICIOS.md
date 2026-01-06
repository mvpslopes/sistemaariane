# 🧹 Como Limpar Dados Fictícios do Sistema

Se você ainda está vendo dados fictícios no sistema, siga estes passos:

## 🔍 Passo 1: Verificar se a API está Configurada

1. Abra o arquivo `.env` na raiz do projeto
2. Verifique se `VITE_API_URL` está configurado com seu domínio:
   ```env
   VITE_API_URL=https://seu-dominio.com/api
   ```

## 🗑️ Passo 2: Limpar localStorage do Navegador

Os dados fictícios podem estar salvos no localStorage do navegador. Para limpar:

### Opção A: Via Console do Navegador

1. Abra o sistema no navegador
2. Pressione `F12` para abrir o DevTools
3. Vá na aba **Console**
4. Cole e execute este comando:

```javascript
// Limpar todos os dados do sistema
localStorage.removeItem('dailyReports');
localStorage.removeItem('user');
console.log('Dados limpos! Recarregue a página.');
```

5. Recarregue a página (F5)

### Opção B: Limpar Tudo do Site

1. Abra o DevTools (F12)
2. Vá na aba **Application** (ou **Aplicativo**)
3. No menu lateral, clique em **Local Storage**
4. Clique no seu domínio
5. Clique com botão direito e selecione **Clear** (Limpar)
6. Recarregue a página

## ✅ Passo 3: Verificar se a API está Funcionando

1. Acesse: `https://seu-dominio.com/api/api.php/health`
2. Deve retornar: `{"status":"ok","database":"connected"}`
3. Se não funcionar, verifique se o arquivo `api.php` está na pasta correta

## 🔄 Passo 4: Fazer Novo Build

Após configurar o `.env`:

```bash
npm run build
```

E faça upload da pasta `dist/` novamente.

## ⚠️ Importante

- **Dados fictícios** são identificados por IDs que começam com `mock-`
- O sistema agora **filtra automaticamente** esses dados
- Se a API não estiver configurada, o sistema mostrará apenas dados reais do localStorage (sem os fictícios)

## 🎯 Resultado Esperado

Após limpar:
- ✅ Dashboard vazio (se não houver registros reais)
- ✅ Apenas dados do banco MySQL serão exibidos
- ✅ Nenhum dado fictício será mostrado

