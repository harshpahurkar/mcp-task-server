import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { TaskRepository } from "./repository.js";
import type { TaskStatus } from "./types.js";

type ToolRunner = (repo: TaskRepository, input: unknown) => unknown;

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
  mcpInputSchema: ZodRawShape;
  httpInputSchema: ZodTypeAny;
  sampleInput: unknown;
  run: ToolRunner;
};

const statusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);
const limitSchema = z.number().int().min(1).max(50).default(10);
const idSchema = z.number().int().positive().max(2_147_483_647);
const tableSchema = z.enum(["tasks", "notes", "records"]);
const projectSchema = z.string().trim().min(1).max(100).optional();

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "list_tasks",
    title: "List tasks",
    description: "List read-only task records, optionally filtered by status.",
    schema: { status: ["todo", "in_progress", "blocked", "done"], limit: "1..50" },
    mcpInputSchema: {
      status: statusSchema.optional(),
      limit: limitSchema
    },
    httpInputSchema: z.object({ status: statusSchema.optional(), limit: limitSchema }),
    sampleInput: { status: "todo", limit: 10 },
    run: (repo, input) => repo.listTasks(input as { status?: TaskStatus; limit?: number })
  },
  {
    name: "get_task",
    title: "Get task",
    description: "Read a single task by positive integer ID.",
    schema: { id: "positive integer" },
    mcpInputSchema: { id: idSchema },
    httpInputSchema: z.object({ id: idSchema }),
    sampleInput: { id: 2 },
    run: (repo, input) => repo.getTask((input as { id: number }).id)
  },
  {
    name: "search_notes",
    title: "Search notes",
    description: "Search read-only notes by title, body, or tag text.",
    schema: { query: "non-empty string", limit: "1..50" },
    mcpInputSchema: {
      query: z.string().trim().min(1),
      limit: limitSchema
    },
    httpInputSchema: z.object({ query: z.string().trim().min(1), limit: limitSchema }),
    sampleInput: { query: "validation", limit: 5 },
    run: (repo, input) => repo.searchNotes(input as { query: string; limit?: number })
  },
  {
    name: "get_note",
    title: "Get note",
    description: "Read a single note by positive integer ID.",
    schema: { id: "positive integer" },
    mcpInputSchema: { id: idSchema },
    httpInputSchema: z.object({ id: idSchema }),
    sampleInput: { id: 1 },
    run: (repo, input) => repo.getNote((input as { id: number }).id)
  },
  {
    name: "read_record",
    title: "Read record",
    description: "Read one record from an allowed SQLite table: tasks, notes, or records.",
    schema: { table: ["tasks", "notes", "records"], id: "positive integer" },
    mcpInputSchema: {
      table: tableSchema,
      id: idSchema
    },
    httpInputSchema: z.object({ table: tableSchema, id: idSchema }),
    sampleInput: { table: "records", id: 1 },
    run: (repo, input) => repo.readRecord(input as { table: string; id: number })
  },
  {
    name: "task_summary",
    title: "Task summary",
    description: "Summarize task counts and high-priority open work, optionally for one project.",
    schema: { project: "optional non-empty string" },
    mcpInputSchema: { project: projectSchema },
    httpInputSchema: z.object({ project: projectSchema }),
    sampleInput: { project: "mcp-server" },
    run: (repo, input) => repo.taskSummary(input as { project?: string })
  }
];

export function findToolDefinition(name: string): ToolDefinition | undefined {
  return toolDefinitions.find((tool) => tool.name === name);
}

export function toolCatalog() {
  return toolDefinitions.map(({ name, description, schema }) => ({
    name,
    description,
    schema,
    annotations: { ...readOnlyAnnotations }
  }));
}
