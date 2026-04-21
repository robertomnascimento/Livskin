# Feegow MCP Server

Servidor MCP que conecta o Claude.ai à API do Feegow.

## Ferramentas disponíveis

| Ferramenta | Descrição |
|---|---|
| `listar_profissionais` | Lista médicos e especialistas |
| `listar_especialidades` | Lista especialidades disponíveis |
| `listar_locais` | Lista unidades de atendimento |
| `listar_convenios` | Lista convênios aceitos |
| `listar_procedimentos` | Lista tipos de procedimento |
| `buscar_paciente` | Busca paciente por CPF ou nome |
| `listar_agendamentos` | Lista consultas por período |
| `horarios_disponiveis` | Horários livres de um profissional |

## Deploy no Render (gratuito)

### 1. Criar repositório no GitHub

Suba esta pasta para um repositório público ou privado no GitHub.

### 2. Criar serviço no Render

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **New → Web Service**
3. Conecte seu repositório GitHub
4. O Render detecta o `render.yaml` automaticamente
5. Em **Environment Variables**, adicione:
   - `FEEGOW_TOKEN` = seu token JWT do Feegow

### 3. Conectar no Claude.ai

1. Acesse **claude.ai → Configurações → Connectors**
2. Clique em **Add custom connector**
3. Cole a URL: `https://feegow-mcp.onrender.com/mcp`
4. Clique em **Add**

Pronto! O Claude terá acesso nativo ao Feegow em todas as conversas.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `FEEGOW_TOKEN` | Token JWT gerado no painel Feegow |
| `PORT` | Porta do servidor (padrão: 3000) |
