import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

const { server, database } = buildServer(process.env.TASK_DB_PATH);
const transport = new StdioServerTransport();

function shutdown(code: number): never {
  database.close();
  process.exit(code);
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

try {
  await server.connect(transport);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
