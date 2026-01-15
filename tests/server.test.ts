import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";

describe("MCP server construction", () => {
  it("registers without requiring external services", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-task-server-"));
    const { server, database } = buildServer(join(dir, "tasks.sqlite"));
    expect(server).toBeDefined();
    database.close();
  });
});
