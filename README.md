# MCP Task Server

Read-only Model Context Protocol server that lets AI agents inspect tasks, notes, and SQLite records through typed tools. The default runtime is stdio so Cursor, Claude Desktop-style clients, and local smoke tests can spawn it as a child process.

The server uses Zod-backed tool schemas, validates every read request, and keeps the database access surface deliberately narrow.

It uses Node 22's built-in `node:sqlite` module. Node currently marks that module experimental, so local tests may print an `ExperimentalWarning`; the smoke path suppresses the warning for client-facing demos.

## Architecture

```text
MCP Client -> stdio JSON-RPC -> McpServer -> Zod tool schema -> TaskRepository -> SQLite
                                      |
                                      v
                              typed text responses
```

## Quickstart

```powershell
cd C:\Users\Harsh\Desktop\Projects\mcp-task-server
npm.cmd install
npm.cmd run seed
npm.cmd run build
npm.cmd test
npm.cmd run smoke
```

The server also auto-creates seed data if `data/tasks.sqlite` does not exist.

## UI Demo: Agent Ledger Console

Agent Ledger Console is a separate browser UI for demonstrating the same read-only data access surface visually. The real MCP runtime remains stdio; the UI uses a small local HTTP bridge that reuses the same SQLite repository and Zod validation rules.

The bridge binds to `127.0.0.1`, restricts browser origins to localhost by default, rate-limits API calls, and does not expose the raw SQLite file path in `/api/health`.

Start the bridge and UI:

```powershell
cd C:\Users\Harsh\Desktop\Projects\mcp-task-server
npm.cmd install
npm.cmd run seed
npm.cmd run web
```

In another terminal:

```powershell
cd C:\Users\Harsh\Desktop\Projects\mcp-task-server\frontend
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5176`.

Demo flow:

1. Inspect the six-tool catalog and read-only annotations.
2. Click **Run list_tasks** and verify task rows appear in the SQLite data browser.
3. Click **Search notes** and inspect the MCP-like response transcript.
4. Click **Unsafe table** and confirm the validation failure is shown as a rejected agent call.

Build the UI for the bridge static route:

```powershell
cd C:\Users\Harsh\Desktop\Projects\mcp-task-server
npm.cmd run build:ui
npm.cmd run web
```

Then open `http://127.0.0.1:5175`.

UI verification:

```powershell
cd C:\Users\Harsh\Desktop\Projects\mcp-task-server
npm.cmd run build
npm.cmd run build:ui
npm.cmd run test:e2e
```

## Tool Catalog

| Tool | Input | Purpose |
| --- | --- | --- |
| `list_tasks` | `{ status?: "todo" | "in_progress" | "blocked" | "done", limit?: 1..50 }` | List tasks with optional status filter |
| `get_task` | `{ id: positive integer }` | Read one task |
| `search_notes` | `{ query: non-empty string, limit?: 1..50 }` | Search note title, body, and tags |
| `get_note` | `{ id: positive integer }` | Read one note |
| `read_record` | `{ table: "tasks" | "notes" | "records", id: positive integer }` | Read one allowed SQLite record |
| `task_summary` | `{ project?: string }` | Summarize counts and high-priority open work |

All tools are read-only. There are no mutation tools in the first version.

## Sample Tool Response

`list_tasks` with `{ "status": "todo", "limit": 2 }` returns a text content block containing JSON:

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

## Cursor / MCP Client Config

After building:

```json
{
  "mcpServers": {
    "task-server": {
      "command": "node",
      "args": [
        "--no-warnings=ExperimentalWarning",
        "C:/Users/Harsh/Desktop/Projects/mcp-task-server/dist/index.js"
      ],
      "env": {
        "TASK_DB_PATH": "C:/Users/Harsh/Desktop/Projects/mcp-task-server/data/tasks.sqlite"
      }
    }
  }
}
```

For source-mode local development:

```json
{
  "mcpServers": {
    "task-server-dev": {
      "command": "npx.cmd",
      "args": ["tsx", "src/index.ts"],
      "cwd": "C:/Users/Harsh/Desktop/Projects/mcp-task-server"
    }
  }
}
```

## Validation And Failure Modes

The server rejects:

- Unknown table names such as `sqlite_master`
- IDs below `1`
- Empty note search strings
- Limits above `50`
- Status values outside `todo`, `in_progress`, `blocked`, and `done`

These failures are intentional. They catch bad LLM tool calls before a client treats malformed output as useful context.

## Docker

```powershell
docker build -t mcp-task-server:local .
npm.cmd run smoke:docker
```

`smoke:docker` starts the container through `StdioClientTransport`, lists the tools, calls `list_tasks`, verifies read-only annotations, and confirms `read_record` rejects an unsafe table name. Because the transport is stdio, interactive MCP clients usually spawn the local Node command directly, while Docker proves the packaged runtime is reproducible.

## Testing

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run smoke
docker build -t mcp-task-server:local .
npm.cmd run smoke:docker
```

The tests cover SQLite schema/seed behavior, read-only repository queries, validation failures, and server construction. The smoke client starts the stdio server, lists registered tools, and calls `list_tasks`.

## Resume Claim Mapping

- Built an MCP server: `src/server.ts`, `src/index.ts`
- Lets AI agents read tasks, notes, SQLite records: tool catalog, `TaskRepository`, and Agent Ledger Console data browser
- Typed handlers with validation: Zod schemas, repository guards, HTTP bridge schemas, and UI Safety Lab
- Tested through local clients: `scripts/smoke-client.ts`, Vitest suite, Docker smoke, and UI Playwright test
