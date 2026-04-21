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
    {
      ativo: z.string().optional().describe("Filtrar ativos: 1 = ativo, 0 = inativo"),
      especialidade_id: z.string().optional().describe("ID da especialidade"),
      unidade_id: z.string().optional().describe("ID da unidade"),
    },
    async ({ ativo, especialidade_id, unidade_id }) => {
      const data = await feegowGet("/professional/list", { ativo, especialidade_id, unidade_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Especialidades
  server.tool(
    "listar_especialidades",
    "Lista todas as especialidades médicas disponíveis na clínica.",
    {},
    async () => {
      const data = await feegowGet("/specialties/list");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Status de agendamentos
  server.tool(
    "listar_status_agendamentos",
    "Lista os possíveis status de agendamentos (marcado, atendido, cancelado, etc).",
    {},
    async () => {
      const data = await feegowGet("/appoints/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Agendamentos
  server.tool(
    "listar_agendamentos",
    "Lista agendamentos/consultas num intervalo de datas.",
    {
      data_inicio: z.string().describe("Data início no formato YYYY-MM-DD"),
      data_fim: z.string().describe("Data fim no formato YYYY-MM-DD"),
      profissional_id: z.string().optional().describe("ID do profissional"),
      local_id: z.string().optional().describe("ID da unidade"),
    },
    async ({ data_inicio, data_fim, profissional_id, local_id }) => {
      const data = await feegowGet("/appoints/list", { data_inicio, data_fim, profissional_id, local_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Relatórios
  server.tool(
    "listar_relatorios",
    "Lista os relatórios disponíveis na clínica.",
    {},
    async () => {
      const data = await feegowGet("/reports/list");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // Buscar paciente
  server.tool(
    "buscar_paciente",
    "Busca informações de um paciente pelo ID, CPF ou nome.",
    {
      paciente_id: z.string().optional().describe("ID do paciente"),
      cpf: z.string().optional().describe("CPF do paciente"),
      nome: z.string().optional().describe("Nome ou parte do nome do paciente"),
    },
    async ({ paciente_id, cpf, nome }) => {
      const data = await feegowGet("/patient/search", { paciente_id, cpf, nome });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
