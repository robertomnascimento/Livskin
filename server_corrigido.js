import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const FEEGOW_TOKEN = process.env.FEEGOW_TOKEN || "";
const BASE_URL = "https://api.feegow.com/v1/api";
const PORT = Number(process.env.PORT || 3000);

function assertTokenConfigured() {
  if (!FEEGOW_TOKEN) {
    throw new Error("FEEGOW_TOKEN não configurado no ambiente.");
  }
}

function removeEmptyParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

async function feegowGet(path, params = {}) {
  assertTokenConfigured();

  const qs = new URLSearchParams(removeEmptyParams(params)).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-access-token": FEEGOW_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Feegow API error: ${response.status} ${response.statusText} - ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function formatResponse(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function requireAtLeastOne(valueMap, message) {
  const hasAnyValue = Object.values(valueMap).some((value) => value !== undefined && value !== null && value !== "");
  if (!hasAnyValue) {
    throw new Error(message);
  }
}

function createMcpServer() {
  const server = new McpServer({ name: "feegow", version: "1.0.1" });

  server.tool(
    "listar_profissionais",
    "Lista profissionais da clínica. ativo=1 por padrão.",
    {
      ativo: z.string().optional(),
      especialidade_id: z.string().optional(),
      unidade_id: z.string().optional()
    },
    async ({ ativo = "1", especialidade_id, unidade_id }) => {
      const data = await feegowGet("/professional/list", {
        ativo,
        especialidade_id,
        unidade_id
      });
      return formatResponse(data);
    }
  );

  server.tool(
    "buscar_profissional",
    "Busca informações e especialidades de um profissional.",
    {
      profissional_id: z.string()
    },
    async ({ profissional_id }) => {
      const data = await feegowGet("/professional/search", { profissional_id });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_especialidades",
    "Lista especialidades médicas da clínica.",
    {
      unidade_id: z.string().optional()
    },
    async ({ unidade_id }) => {
      const data = await feegowGet("/specialties/list", { unidade_id });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_agendamentos",
    "Lista agendamentos por data, profissional, paciente e outros filtros.",
    {
      agendamento_id: z.string().optional(),
      data_start: z.string().optional().describe("DD-MM-YYYY"),
      data_end: z.string().optional().describe("DD-MM-YYYY"),
      retorno: z.string().optional(),
      profissional_id: z.string().optional(),
      paciente_id: z.string().optional(),
      unidade_id: z.string().optional(),
      local_id: z.string().optional(),
      especialidade_id: z.string().optional(),
      canal_id: z.string().optional(),
      procedimento_id: z.string().optional(),
      list_procedures: z.string().optional(),
      start: z.string().optional(),
      offset: z.string().optional()
    },
    async (params) => {
      const data = await feegowGet("/appoints/search", params);
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_status_agendamentos",
    "Lista os status possíveis de agendamento.",
    {},
    async () => {
      const data = await feegowGet("/appoints/status");
      return formatResponse(data);
    }
  );

  server.tool(
    "buscar_paciente",
    "Busca paciente por ID ou CPF.",
    {
      paciente_id: z.string().optional(),
      paciente_cpf: z.string().optional().describe("11 dígitos sem pontos")
    },
    async ({ paciente_id, paciente_cpf }) => {
      requireAtLeastOne(
        { paciente_id, paciente_cpf },
        "Informe pelo menos paciente_id ou paciente_cpf para buscar_paciente."
      );

      const data = await feegowGet("/patient/search", {
        paciente_id,
        paciente_cpf
      });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_pacientes",
    "Lista pacientes com filtros por CPF ou telefone.",
    {
      cpf: z.string().optional(),
      telefone: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional()
    },
    async ({ cpf, telefone, limit = "50", offset = "0" }) => {
      const data = await feegowGet("/patient/list", {
        cpf,
        telefone,
        limit,
        offset
      });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_convenios",
    "Lista convênios aceitos pela clínica.",
    {
      unidade_id: z.string().optional()
    },
    async ({ unidade_id }) => {
      const data = await feegowGet("/insurance/list", { unidade_id });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_unidades",
    "Lista unidades e locais de atendimento.",
    {},
    async () => {
      const data = await feegowGet("/company/list-unity");
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_procedimentos",
    "Lista procedimentos disponíveis.",
    {
      tipo_procedimento: z.string().optional(),
      especialidade_id: z.string().optional(),
      profissional_id: z.string().optional(),
      unidade_id: z.string().optional(),
      paciente_id: z.string().optional(),
      tabela_id: z.string().optional()
    },
    async (params) => {
      const data = await feegowGet("/procedures/list", params);
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_relatorios",
    "Lista relatórios disponíveis na clínica.",
    {},
    async () => {
      const data = await feegowGet("/reports/list");
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_propostas",
    "Lista propostas comerciais por data. Retorna status, procedimentos, valor total e forma de pagamento.",
    {
      data_proposta: z.string().optional().describe("Data das propostas no formato YYYY-MM-DD (ex: 2026-04-22)"),
      data_alteracao: z.string().optional().describe("Data de alteração no formato YYYY-MM-DD (opcional)"),
      paciente_id: z.string().optional().describe("ID do paciente para filtrar. Use 0 para todos os pacientes.")
    },
    async ({ data_proposta, data_alteracao, paciente_id = "0" }) => {
      const data = await feegowGet("/proposal/list-dates", {
        data_proposta,
        data_alteracao,
        PacienteID: paciente_id
      });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_financeiro",
    "Lista contas e faturas do financeiro com detalhes de pagamento.",
    {
      data_start: z.string().optional().describe("Data inicial no formato DD-MM-YYYY (ex: 22-04-2026)"),
      data_end: z.string().optional().describe("Data final no formato DD-MM-YYYY (ex: 22-04-2026)"),
      tipo_transacao: z.string().optional().describe("C = Crédito (entradas), D = Débito (saídas). Opcional."),
      unidade_id: z.string().optional().describe("ID da unidade. Use 0 para todas as unidades.")
    },
    async ({ data_start, data_end, tipo_transacao, unidade_id = "0" }) => {
      const data = await feegowGet("/financial/list-invoice", {
        data_start,
        data_end,
        tipo_transacao,
        unidade_id
      });
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_motivos_cancelamento",
    "Lista todos os motivos disponíveis para cancelamento ou reagendamento de consultas.",
    {},
    async () => {
      const data = await feegowGet("/appoints/motives");
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_bandeiras_cartao",
    "Lista as bandeiras de cartão de crédito/débito disponíveis no sistema.",
    {},
    async () => {
      const data = await feegowGet("/financial/credit-card-flags");
      return formatResponse(data);
    }
  );

  server.tool(
    "listar_origens_paciente",
    "Lista as origens e canais de captação de pacientes cadastrados no sistema.",
    {},
    async () => {
      const data = await feegowGet("/patient/list-sources");
      return formatResponse(data);
    }
  );

  return server;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "feegow-mcp",
    health: "/health",
    mcp: "/mcp"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "feegow-mcp",
    tokenConfigured: Boolean(FEEGOW_TOKEN)
  });
});

app.all("/mcp", async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    res.on("close", () => {
      void transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body ?? undefined);
  } catch (error) {
    console.error("Erro no endpoint /mcp:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Erro interno no servidor MCP"
        },
        id: null
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Feegow MCP server running on port ${PORT}`);

  if (!FEEGOW_TOKEN) {
    console.warn("FEEGOW_TOKEN não configurado.");
  }
});
