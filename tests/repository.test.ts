import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseManager } from "../src/database.js";
import { TaskRepository } from "../src/repository.js";

let database: DatabaseManager;
let repo: TaskRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-task-server-"));
  database = new DatabaseManager(join(dir, "tasks.sqlite"));
  repo = new TaskRepository(database.db);
});

afterEach(() => {
  database.close();
});

describe("TaskRepository", () => {
  it("lists seeded tasks and filters by status", () => {
    const todo = repo.listTasks({ status: "todo", limit: 10 });
    expect(todo.length).toBeGreaterThanOrEqual(2);
    expect(todo.every((task) => task.status === "todo")).toBe(true);
  });

  it("reads tasks, notes, and generic records", () => {
    expect(repo.getTask(1).title).toContain("RAG");
    expect(repo.getNote(1).tags).toContain("validation");
    expect(repo.readRecord({ table: "records", id: 1 })).toMatchObject({ key: "owner" });
  });

  it("rejects unsafe table names and invalid IDs", () => {
    expect(() => repo.readRecord({ table: "sqlite_master", id: 1 })).toThrow(/table must be one of/);
    expect(() => repo.getTask(0)).toThrow(/positive safe integer/);
    expect(() => repo.getTask(-1)).toThrow(/positive safe integer/);
    expect(() => repo.getTask(1.5)).toThrow(/positive safe integer/);
    expect(() => repo.getTask(Number.MAX_SAFE_INTEGER)).toThrow(/positive safe integer/);
  });

  it("rejects empty note queries and oversized limits", () => {
    expect(() => repo.searchNotes({ query: "   " })).toThrow(/query must not be empty/);
    expect(() => repo.searchNotes({ query: null as unknown as string })).toThrow(/query must not be empty/);
    expect(() => repo.searchNotes({ query: "🧪 validation", limit: 5 })).not.toThrow();
    expect(() => repo.listTasks({ limit: 100 })).toThrow(/between 1 and 50/);
    expect(() => repo.listTasks({ status: "bad" as never })).toThrow(/status must be one of/);
  });

  it("creates indexes for common read paths", () => {
    const taskIndexes = database.db.prepare("PRAGMA index_list('tasks')").all() as Array<{ name: string }>;
    const noteIndexes = database.db.prepare("PRAGMA index_list('notes')").all() as Array<{ name: string }>;
    const recordIndexes = database.db.prepare("PRAGMA index_list('records')").all() as Array<{ name: string }>;
    expect(taskIndexes.map((row) => row.name)).toContain("idx_tasks_status_id");
    expect(taskIndexes.map((row) => row.name)).toContain("idx_tasks_project_id");
    expect(noteIndexes.map((row) => row.name)).toContain("idx_notes_body");
    expect(recordIndexes.map((row) => row.name)).toContain("idx_records_kind_key");
  });

  it("summarizes open high priority work", () => {
    const summary = repo.taskSummary({ project: "mcp-server" });
    expect(summary.matching_project).toBe("mcp-server");
    expect(summary.high_priority_open.some((task) => task.title.includes("validation"))).toBe(true);
  });
});
