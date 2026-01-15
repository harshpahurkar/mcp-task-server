import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const useDocker = process.argv.includes("--docker");
const transport = new StdioClientTransport(
  useDocker
    ? {
        command: "docker",
        args: ["run", "--rm", "-i", "mcp-task-server:local"],
        cwd: root
      }
    : {
        command: "node",
        args: ["--no-warnings=ExperimentalWarning", "--import", "tsx", "src/index.ts"],
        cwd: root,
        env: { ...process.env, TASK_DB_PATH: resolve(root, "data", "tasks.sqlite") }
      }
);

const client = new Client({ name: "mcp-task-smoke-client", version: "0.1.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(JSON.stringify({ tools: tools.tools.map((tool) => tool.name) }, null, 2));
const toolsWithoutReadOnlyHint = tools.tools.filter((tool) => tool.annotations?.readOnlyHint !== true);
if (toolsWithoutReadOnlyHint.length > 0) {
  throw new Error(`Tools missing readOnlyHint: ${toolsWithoutReadOnlyHint.map((tool) => tool.name).join(", ")}`);
}

const result = await client.callTool({ name: "list_tasks", arguments: { status: "todo", limit: 2 } });
console.log(JSON.stringify(result, null, 2));

try {
  await client.callTool({ name: "read_record", arguments: { table: "sqlite_master", id: 1 } });
  throw new Error("read_record accepted an unsafe table name");
} catch (error) {
  console.log(JSON.stringify({ invalid_call_rejected: true }, null, 2));
}

await client.close();
