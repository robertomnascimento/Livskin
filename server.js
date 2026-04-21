import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import fetch from "node-fetch";
import { z } from "zod";

const FEEGOW_TOKEN = process.env.FEEGOW_TOKEN || "";
const BASE_URL = "https://api.feegow.com/v1/api";
const PORT = process.env.PORT || 3000;

// ─── Feegow API helper ───────────────────────────────────────────────────────
async function feegowGet(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  ).toString();
  const url = `${BASE_URL}${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, {
    headers: { "x-access-token": FEEGOW_TOKEN, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Feegow API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ─── MCP Server factory ──────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({
    name: "feegow",
    version: "1.0.0",
  });

  // Profissionais
  server.tool(
    "listar_profissionais",
    "Lista todos os profissionais de saúde cadastrados na clínica.",
    {},
    async () => {
      const data = await feegowGet("/profissionais");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Especialidades
  server.tool(
    "listar_especialidades",
    "Lista todas as especialidades médicas disponíveis na clínica.",
    {},
    async () => {
      const data = await feegowGet("/especialidades");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Locais / Unidades
  server.tool(
    "listar_locais",
    "Lista as unidades/locais de atendimento da clínica.",
    {},
    async () => {
      const data = await feegowGet("/locais");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Convênios
  server.tool(
    "listar_convenios",
    "Lista os convênios/planos de saúde aceitos pela clínica.",
    {},
    async () => {
      const data = await feegowGet("/convenio");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Procedimentos
  server.tool(
    "listar_procedimentos",
    "Lista os procedimentos e tipos de consulta disponíveis.",
    {},
    async () => {
      const data = await feegowGet("/procedimentos");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Buscar paciente
  server.tool(
    "buscar_paciente",
    "Busca pacientes pelo CPF ou nome.",
    {
      cpf: z.string().optional().describe("CPF do paciente (ex: 000.000.000-00)"),
      nome: z.string().optional().describe("Nome ou parte do nome do paciente"),
    },
    async ({ cpf, nome }) => {
      const data = await feegowGet("/pacientes", { cpf, nome });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Agendamentos
  server.tool(
    "listar_agendamentos",
    "Lista agendamentos/consultas num intervalo de datas.",
    {
      data_inicio: z.string().optional().describe("Data início no formato YYYY-MM-DD"),
      data_fim: z.string().optional().describe("Data fim no formato YYYY-MM-DD"),
      profissional_id: z.string().optional().describe("ID do profissional"),
      local_id: z.string().optional().describe("ID da unidade"),
    },
    async ({ data_inicio, data_fim, profissional_id, local_id }) => {
      const data = await feegowGet("/agendamentos", {
        data_inicio,
        data_fim,
        profissional_id,
        local_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Horários disponíveis
  server.tool(
    "horarios_disponiveis",
    "Consulta horários disponíveis para agendamento de um profissional numa data.",
    {
      profissional_id: z.string().describe("ID do profissional"),
      data: z.string().describe("Data no formato YYYY-MM-DD"),
      local_id: z.string().optional().describe("ID da unidade (opcional)"),
      especialidade_id: z.string().optional().describe("ID da especialidade (opcional)"),
    },
    async ({ profissional_id, data, local_id, especialidade_id }) => {
      const result = await feegowGet("/horarios-disponiveis", {
        profissional_id,
        data,
        local_id,
        especialidade_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", service: "feegow-mcp" }));

app.all("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Feegow MCP server running on port ${PORT}`);
  if (!FEEGOW_TOKEN) console.warn("⚠️  FEEGOW_TOKEN not set!");
});
