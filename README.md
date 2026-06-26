# 🤖 Controle Financeiro

App de controle financeiro pessoal com IA, desenvolvido em React.

## Como subir na Vercel

### 1. Subir no GitHub
- Crie um repositório no GitHub (ex: `controle-financeiro`)
- Faça upload de todos os arquivos desta pasta

### 2. Conectar na Vercel
- Acesse vercel.com e clique em "Add New Project"
- Importe o repositório do GitHub
- Em "Environment Variables", adicione:
  - Nome: `REACT_APP_ANTHROPIC_KEY`
  - Valor: sua chave da API Anthropic (console.anthropic.com)
- Clique em "Deploy"

### 3. Pronto!
O app estará disponível em um link `.vercel.app`.
No celular, acesse o link e clique em "Adicionar à tela inicial" para instalar como app.

## Obter chave da API Anthropic
1. Acesse console.anthropic.com
2. Crie uma conta gratuita
3. Vá em "API Keys" e gere uma chave
4. Cole na Vercel conforme passo 2
