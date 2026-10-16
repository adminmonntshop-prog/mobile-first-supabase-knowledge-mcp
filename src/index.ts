import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { recordObservation, searchKnowledge } from "./knowledge.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "mobile-first-supabase-knowledge-mcp" }));

function makeServer() {
  const server = new McpServer({
    name: "mobile-first-supabase-knowledge",
    version: "0.1.0"
  });

  server.tool(
    "search_mobile_supabase_knowledge",
    "Search Supabase usage knowledge prioritized for Chrome on Android. State confidence and sources; do not invent exact button locations.",
    {
      query: z.string().min(2).max(500).describe("Question or keywords, e.g. where to find API settings on Android Chrome"),
      platform: z.enum(["android-chrome", "desktop", "all"]).default("android-chrome"),
      limit: z.number().int().min(1).max(10).default(5)
    },
    async ({ query, platform, limit }) => {
      const results = await searchKnowledge(query, platform, limit);
      return { content: [{ type: "text", text: JSON.stringify({
        guidance: "Prefer verified Android Chrome observations. UI positions may change; ask for a screenshot if exact placement is uncertain.",
        results
      }, null, 2) }] };
    }
  );

  server.tool(
    "propose_change_plan",
    "Create a plan before consequential work. This tool does not execute changes; the assistant must show the plan and obtain explicit user approval.",
    {
      goal: z.string().min(3).max(1000),
      proposed_actions: z.array(z.string().min(1).max(300)).min(1).max(12),
      risk: z.enum(["low", "medium", "high"]),
      needs_data_change: z.boolean().default(false)
    },
    async ({ goal, proposed_actions, risk, needs_data_change }) => {
      const plan = {
        plan_id: randomUUID(),
        status: "AWAITING_USER_APPROVAL",
        goal,
        proposed_actions,
        risk,
        needs_data_change,
        approval_rule: "Do not execute consequential changes until the user explicitly approves this exact plan.",
        created_at: new Date().toISOString()
      };
      return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
    }
  );

  server.tool(
    "review_code",
    "Perform a second-pass checklist review of supplied code. Be explicit that this is static review, not a real build/test unless tools actually ran them.",
    {
      language: z.string().min(1).max(80),
      code: z.string().min(1).max(30000),
      context: z.string().max(3000).default(""),
      checks: z.array(z.enum([
        "syntax_and_structure", "security_and_secrets", "supabase_rls",
        "android_compatibility", "error_handling", "dependencies", "tests"
      ])).default(["syntax_and_structure", "security_and_secrets", "error_handling", "dependencies"])
    },
    async ({ language, code, context, checks }) => {
      const findings: string[] = [];
      if (/service_role|sb_secret_[A-Za-z0-9_-]+/i.test(code)) {
        findings.push("Potential Supabase privileged/secret key marker detected. Verify this is a placeholder or server-only environment variable; never ship it in Android/client code.");
      }
      if (/TODO|FIXME|IMPLEMENT ME/i.test(code)) findings.push("Unfinished TODO/FIXME marker found; confirm it is intentional.");
      if (!findings.length) findings.push("No obvious high-risk marker found by the basic automated scan. This does not prove the code is correct or secure.");
      const report = {
        review_type: "static_second_pass",
        language,
        context,
        checks_requested: checks,
        findings,
        limits: [
          "No compiler, Gradle build, unit tests, or live Supabase request was run by this tool.",
          "Review the full project and dependency versions for a reliable result.",
          "For Android, run the build in AndroidIDE and share the complete error output if it fails."
        ],
        reviewed_at: new Date().toISOString()
      };
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }
  );

  server.tool(
    "record_ui_observation",
    "Record a user-observed Supabase Dashboard UI location for Android Chrome. New observations are always marked unverified until checked against a current screenshot or authoritative source.",
    {
      title: z.string().min(3).max(200),
      body: z.string().min(5).max(5000),
      page: z.string().max(300).optional(),
      source_url: z.string().url().optional(),
      ui_version: z.string().max(100).optional()
    },
    async (input) => {
      const result = await recordObservation(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

// Stateless HTTP transport: create a fresh MCP server/transport per request.
app.post("/mcp", async (req, res) => {
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Use Streamable HTTP POST for this stateless MCP endpoint." });
});
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "Stateless endpoint does not support session deletion." }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`MCP server listening on port ${port}`));
