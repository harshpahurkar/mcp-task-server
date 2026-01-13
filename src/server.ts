import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DatabaseManager } from "./database.js";
import { TaskRepository } from "./repository.js";
import { readOnlyAnnotations, toolDefinitions } from "./tools.js";

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
  };
}

function errorContent(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)
      }
    ]
  };
}

async function safeToolCall<T>(operation: () => T): Promise<ReturnType<typeof jsonContent> | ReturnType<typeof errorContent>> {
  try {
    return jsonContent(operation());
  } catch (error) {
    return errorContent(error);
  }
}

export function buildServer(dbPath?: string): { server: McpServer; database: DatabaseManager } {
  const database = new DatabaseManager(dbPath);
  const repo = new TaskRepository(database.db);
  const server = new McpServer({ name: "mcp-task-server", version: "0.1.0" });

  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        annotations: { ...readOnlyAnnotations, title: tool.title },
        inputSchema: tool.mcpInputSchema
      },
      async (input) => safeToolCall(() => tool.run(repo, input))
    );
  }

  return { server, database };
}
