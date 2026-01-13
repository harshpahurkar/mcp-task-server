import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { ZodError } from "zod";
import { DatabaseManager } from "./database.js";
import { TaskRepository } from "./repository.js";
import { findToolDefinition, toolCatalog, toolDefinitions } from "./tools.js";

const db = new DatabaseManager(process.env.TASK_DB_PATH);
const repo = new TaskRepository(db.db);
const staticCache = new Map<string, { body: Buffer; contentType: string }>();
const requestCounts = new Map<string, { windowStart: number; count: number }>();
const rateLimitWindowMs = Number(process.env.MCP_RATE_LIMIT_WINDOW_MS ?? 60_000);
const rateLimitMax = Number(process.env.MCP_RATE_LIMIT_MAX ?? 120);
const allowedOrigins = new Set(
  (process.env.MCP_ALLOWED_ORIGINS ?? "http://127.0.0.1:5175,http://127.0.0.1:5176,http://localhost:5175,http://localhost:5176")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin"
  };
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders(request)
  });
  response.end(JSON.stringify(payload));
}

function rateLimitKey(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown";
}

function isRateLimited(request: IncomingMessage): boolean {
  const now = Date.now();
  const key = rateLimitKey(request);
  const current = requestCounts.get(key);
  if (!current || now - current.windowStart >= rateLimitWindowMs) {
    requestCounts.set(key, { windowStart: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > rateLimitMax;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  return raw ? JSON.parse(raw) : {};
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

async function serveStatic(request: IncomingMessage, requestPath: string, response: ServerResponse): Promise<void> {
  if (requestPath === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }
  const dist = resolve(process.cwd(), "frontend", "dist");
  const safePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const target = resolve(dist, safePath);
  const file = target.startsWith(dist) && existsSync(target) ? target : join(dist, "index.html");
  if (!existsSync(file)) {
    sendJson(request, response, 200, {
      app: "Agent Ledger Console",
      detail: "Frontend build not found. Run npm.cmd install and npm.cmd run build:ui.",
      tools: toolCatalog()
    });
    return;
  }
  const cached = staticCache.get(file);
  if (cached) {
    response.writeHead(200, { "content-type": cached.contentType, "cache-control": "public, max-age=300" });
    response.end(cached.body);
    return;
  }
  const body = await readFile(file);
  const type = contentType(file);
  staticCache.set(file, { body, contentType: type });
  response.writeHead(200, { "content-type": type, "cache-control": "public, max-age=300" });
  response.end(body);
}

async function handleApi(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  if (isRateLimited(request)) {
    sendJson(request, response, 429, { error: "Rate limit exceeded" });
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(request, response, 200, {
      status: "ok",
      runtime: "http-bridge",
      database: process.env.TASK_DB_PATH ? "configured" : "default",
      read_only: true,
      tools: toolDefinitions.length
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/tools") {
    sendJson(request, response, 200, { tools: toolCatalog() });
    return;
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/tools/")) {
    const name = decodeURIComponent(url.pathname.replace("/api/tools/", ""));
    const tool = findToolDefinition(name);
    if (!tool) {
      sendJson(request, response, 404, { error: `Unknown tool: ${name}` });
      return;
    }
    try {
      const body = await readBody(request);
      const input = tool.httpInputSchema.parse(body);
      const result = tool.run(repo, input);
      sendJson(request, response, 200, {
        tool: name,
        input,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        result
      });
    } catch (error) {
      if (error instanceof ZodError) {
        sendJson(request, response, 400, { tool: name, error: "Validation failed", issues: error.issues });
        return;
      }
      sendJson(request, response, 400, { tool: name, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  sendJson(request, response, 404, { error: "Not found" });
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url).catch((error) => {
      console.error(error);
      sendJson(request, response, 500, { error: "Internal server error" });
    });
  } else {
    serveStatic(request, url.pathname, response).catch((error) => {
      console.error(error);
      sendJson(request, response, 500, { error: "Internal server error" });
    });
  }
});

const port = Number(process.env.PORT ?? 5175);
server.listen(port, "127.0.0.1", () => {
  console.log(`Agent Ledger Console bridge listening on http://127.0.0.1:${port}`);
});

process.on("SIGINT", () => {
  db.close();
  server.close(() => process.exit(0));
});
