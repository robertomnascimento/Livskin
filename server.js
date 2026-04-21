import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import fetch from "node-fetch";
import { z } from "zod";

const FEEGOW_TOKEN = process.env.FEEGOW_TOKEN || "";
const BASE_URL = "https://api.feegow.com/v1/api";
const PORT = process.env.PORT || 3000;

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

function createMcpServer() {
  const server = new McpServer({ name: "feegow", version: "1.0.0" });

  server.tool("listar_profissionais", "Lista profissionais da clínica. ativo=1 por padrão.",
    { ativo: z.string().optional(), especialidade_id: z.string().optional(), unidade_id: z.string().optional() },
    async ({ ativo = "1", especialidade_id, unidade_id }) => {
      const data = await feegowGet("/professional/list", { ativo, especialidade_id, unidade_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("buscar_profissional", "Busca informações e especialidades de um profissional.",
    { profissional_id: z.string() },
    async ({ profissional_id }) => {
      const data = await feegowGet("/professional/search", { profissional_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_especialidades", "Lista especialidades médicas da clínica.",
    { unidade_id: z.string().optional() },
    async ({ unidade_id }) => {
      const data = await feegowGet("/specialties/list", { unidade_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_agendamentos", "Lista agendamentos por data/profissional/paciente.",
    {
      data_start: z.string().optional().describe("DD-MM-YYYY"),
      data_end: z.string().optional().describe("DD-MM-YYYY"),
      profissional_id: z.string().optional(),
      paciente_id: z.string().optional(),
      unidade_id: z.string().optional(),
      especialidade_id: z.string().optional(),
    },
    async (params) => {
      const data = await feegowGet("/appoints/search", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_status_agendamentos", "Lista os status possíveis de agendamento.", {},
    async () => {
      const data = await feegowGet("/appoints/status");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("buscar_paciente", "Busca paciente por ID ou CPF.",
    { paciente_id: z.string().optional(), paciente_cpf: z.string().optional().describe("11 dígitos sem pontos") },
    async ({ paciente_id, paciente_cpf }) => {
      const data = await feegowGet("/patient/search", { paciente_id, paciente_cpf });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_pacientes", "Lista pacientes com filtros por CPF ou telefone.",
    { cpf: z.string().optional(), telefone: z.string().optional(), limit: z.string().optional(), offset: z.string().optional() },
    async ({ cpf, telefone, limit = "50", offset = "0" }) => {
      const data = await feegowGet("/patient/list", { cpf, telefone, limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_convenios", "Lista convênios aceitos pela clínica.",
    { unidade_id: z.string().optional() },
    async ({ unidade_id }) => {
      const data = await feegowGet("/insurance/list", { unidade_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_unidades", "Lista unidades e locais de atendimento.", {},
    async () => {
      const data = await feegowGet("/company/list-unity");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_procedimentos", "Lista procedimentos disponíveis.",
    { tipo_procedimento: z.string().optional(), especialidade_id: z.string().optional(), profissional_id: z.string().optional(), unidade_id: z.string().optional() },
    async (params) => {
      const data = await feegowGet("/procedures/list", params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool("listar_relatorios", "Lista relatórios disponíveis na clínica.", {},
    async () => {
      const data = await feegowGet("/reports/list");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());
app.get("/health", (req, res) => res.json({ status: "ok", service: "feegow-mcp" }));
app.all("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Feegow MCP server running on port ${PORT}`);
  if (!FEEGOW_TOKEN) console.warn("⚠️  FEEGOW_TOKEN not set!");
});
