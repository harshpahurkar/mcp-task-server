<h1 align="center">MCP Task Server</h1>

<p align="center">
  <em>Read-only Model Context Protocol server — lets AI agents inspect local SQLite tasks, notes, and records through six typed tools, with every bad LLM tool call rejected before it reaches the database.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-22%2B-339933?logo=node.js&logoColor=white&style=flat-square" alt="Node 22+" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MCP-stdio%20%2B%20HTTP%20bridge-6366F1?style=flat-square" alt="MCP" />
  <img src="https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white&style=flat-square" alt="SQLite" />
  <img src="https://img.shields.io/badge/Zod-schema%20validation-F97316?style=flat-square" alt="Zod" />
  <img src="https://img.shields.io/github/license/harshpahurkar/mcp-task-server?style=flat-square" alt="License" />
</p>

---

**MCP Task Server** is a read-only [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI agents (Cursor, Claude Desktop, custom clients) safely query a local SQLite database of tasks, notes, and records — without any mutation risk. The server exposes **six strictly-typed tools** backed by Zod schemas and an explicit query allowlist. Every invalid input — wrong table name, out-of-range ID, empty search string, bad status value — is rejected at the validation layer before reaching SQLite.

The core design principle: *an AI agent should be able to read your local data without being able to change it.* This project proves that guarantee with code, tests, and a live safety demo.

## Key Features

- **Six read-only tools** with Zod-enforced input schemas — no mutation tools exist
- **Query allowlist** (`READ_RECORD_QUERIES`) — table access is a fixed constant, never string-interpolated
- **Input guards** — `assertPositiveId`, `assertNonEmptyQuery`, `assertTaskStatus`, `assertPositiveLimit` on every call
- **Zero-framework HTTP bridge** — hand-rolled `node:http` server with CORS allowlist and per-IP rate limiting
- **Native SQLite** — uses Node 22's built-in `node:sqlite` (no ORM, no extra runtime deps)
- **Smoke client** — a TypeScript contract test that spawns the server via stdio and calls every tool end-to-end
- **React dashboard** (Agent Ledger Console) — browse data, run calls, and watch invalid calls fail in real time

## Quickstart

```bash
npm install
npm run seed        # creates data/tasks.sqlite with sample tasks, notes, records
npm run build
npm test            # Vitest unit suite
npm run smoke       # stdio end-to-end contract test
```

```bash
# HTTP bridge + React UI
npm run web                              # bridge → http://127.0.0.1:5175
cd frontend && npm install && npm run dev  # UI    → http://127.0.0.1:5176
```

**Demo flow:**
1. Browse the six-tool catalog and read-only annotations
2. Click **Run list_tasks** — task rows appear in the data browser
3. Click **Try unsafe table** — watch the server reject `sqlite_master` in real time
4. Open the call transcript to see raw MCP-like request/response payloads

## Architecture

```
MCP Client (Cursor / Claude Desktop / smoke-client.ts)
      │
      │  stdio JSON-RPC  (MCP protocol)
      ▼
┌──────────────────────────────────────────────────────────┐
│                       MCP Server                         │
│   McpServer (stdio)  ←→  Zod tool schema validation     │
│           │                                              │
│           ▼                                              │
│   TaskRepository                                         │
│   ├── READ_RECORD_QUERIES allowlist  (const, not dynamic)│
│   ├── assertPositiveId / assertPositiveLimit             │
│   ├── assertNonEmptyQuery / assertTaskStatus             │
│   └── node:sqlite  →  data/tasks.sqlite                  │
└──────────────────────────────────────────────────────────┘

Browser clients use the HTTP bridge instead of stdio:

Browser  →  zero-framework node:http  (CORS allowlist + per-IP rate limit)
         →  same TaskRepository + same Zod validators
         →  same SQLite file
```

## Tool Catalog

| Tool | Inputs | Returns |
|------|--------|---------|
| `list_tasks` | `status?` · `limit? (1–50)` | Tasks array with optional status filter |
| `get_task` | `id` (positive integer) | Single task record |
| `search_notes` | `query` (non-empty) · `limit? (1–50)` | Notes matching title, body, or tags |
| `get_note` | `id` (positive integer) | Single note record |
| `read_record` | `table` (`tasks`\|`notes`\|`records`) · `id` | Any allowlisted table record |
| `task_summary` | `project?` | Status counts + high-priority open items |

All tools carry `readOnlyAnnotations: { readOnlyHint: true, destructiveHint: false }`. These annotations are defined once in `src/tools.ts` and exported as the single source of truth for both the MCP server and the HTTP bridge.

## Validation & Failure Modes

The server intentionally rejects these inputs:

| Input | Rejection |
|-------|-----------|
| `table: "sqlite_master"` | Not in `READ_RECORD_QUERIES` allowlist |
| `id: 0` or `id: -1` | Fails `assertPositiveId` guard |
| `query: ""` | Fails `assertNonEmptyQuery` guard |
| `limit: 100` | Exceeds maximum of 50 |
| `status: "cancelled"` | Not in `todo\|in_progress\|blocked\|done` |

These failures happen at the Zod layer — before any SQL runs. The Agent Ledger Console safety presets let you trigger each one in real time and watch the rejection in the call transcript.

## Sample Tool Response

`list_tasks` with `{ "status": "todo", "limit": 2 }`:

```json
[
  {
    "id": 2,
    "title": "Review MCP tool validation",
    "status": "todo",
    "priority": "high",
    "project": "mcp-server"
  }
]
```

## Cursor / Claude Desktop Config

**Built (recommended):**

```json
{
  "mcpServers": {
    "task-server": {
      "command": "node",
      "args": [
        "--no-warnings=ExperimentalWarning",
        "/absolute/path/to/mcp-task-server/dist/index.js"
      ],
      "env": {
        "TASK_DB_PATH": "/absolute/path/to/mcp-task-server/data/tasks.sqlite"
      }
    }
  }
}
```

**Source / dev mode (tsx):**

```json
{
  "mcpServers": {
    "task-server-dev": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/mcp-task-server"
    }
  }
}
```

## Docker

```bash
docker build -t mcp-task-server:local .
npm run smoke:docker
```

`smoke:docker` spawns the container through `StdioClientTransport`, lists all registered tools, calls `list_tasks`, verifies `readOnlyHint: true` on all tools, and confirms `read_record` rejects `sqlite_master`. Because MCP is stdio, interactive clients spawn the Node binary directly — Docker proves the packaged artifact is reproducible.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node 22 · TypeScript 5 |
| MCP | `@modelcontextprotocol/sdk` (stdio transport) |
| Database | `node:sqlite` (Node built-in, no ORM) |
| Validation | Zod |
| HTTP Bridge | `node:http` (zero-framework, CORS + rate-limit) |
| Frontend | React 18 · Vite · TanStack Query · Tailwind CSS |
| Testing | Vitest · Playwright E2E · TypeScript smoke client |
| Containers | Docker (non-root user, healthcheck) |

## Testing

```bash
# Unit tests
npm run build && npm test

# Smoke test (spawns the stdio server, calls every tool, checks annotations)
npm run smoke

# Docker smoke (proves packaged runtime)
docker build -t mcp-task-server:local . && npm run smoke:docker

# Frontend E2E
cd frontend && npm run build && npm run test:e2e
```

## License

MIT
