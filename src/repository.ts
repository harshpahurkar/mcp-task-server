import type { Note, RecordRow, Task, TaskStatus } from "./types.js";

type SQLiteDatabase = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
};

const READ_RECORD_QUERIES = {
  tasks: "SELECT id, title, status, priority, project, due_date, created_at FROM tasks WHERE id = ?",
  notes: "SELECT id, title, body, tags, created_at FROM notes WHERE id = ?",
  records: "SELECT id, kind, key, value, created_at FROM records WHERE id = ?"
} as const;
const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done"]);

type ReadableTable = keyof typeof READ_RECORD_QUERIES;

function isReadableTable(table: string): table is ReadableTable {
  return Object.prototype.hasOwnProperty.call(READ_RECORD_QUERIES, table);
}

function assertPositiveId(id: number): void {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) {
    throw new Error("id must be a positive safe integer no larger than 2147483647");
  }
}

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("limit must be an integer between 1 and 50");
  }
}

function assertNonEmptyQuery(query: string): void {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("query must not be empty");
  }
}

function assertTaskStatus(status: string): asserts status is TaskStatus {
  if (!TASK_STATUSES.has(status)) {
    throw new Error("status must be one of: todo, in_progress, blocked, done");
  }
}

export class TaskRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  listTasks(input: { status?: TaskStatus; limit?: number }): Task[] {
    const limit = input.limit ?? 10;
    assertLimit(limit);
    if (input.status !== undefined) {
      assertTaskStatus(input.status);
      return this.db
        .prepare(
          "SELECT id, title, status, priority, project, due_date, created_at FROM tasks WHERE status = ? ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, id LIMIT ?"
        )
        .all(input.status, limit) as Task[];
    }
    return this.db
      .prepare("SELECT id, title, status, priority, project, due_date, created_at FROM tasks ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, id LIMIT ?")
      .all(limit) as Task[];
  }

  getTask(id: number): Task {
    assertPositiveId(id);
    const task = this.db
      .prepare("SELECT id, title, status, priority, project, due_date, created_at FROM tasks WHERE id = ?")
      .get(id) as Task | undefined;
    if (!task) {
      throw new Error(`task ${id} was not found`);
    }
    return task;
  }

  searchNotes(input: { query: string; limit?: number }): Note[] {
    const limit = input.limit ?? 10;
    assertLimit(limit);
    assertNonEmptyQuery(input.query);
    const term = `%${input.query.trim()}%`;
    return this.db
      .prepare(
        "SELECT id, title, body, tags, created_at FROM notes WHERE title LIKE ? OR body LIKE ? OR tags LIKE ? ORDER BY id LIMIT ?"
      )
      .all(term, term, term, limit) as Note[];
  }

  getNote(id: number): Note {
    assertPositiveId(id);
    const note = this.db.prepare("SELECT id, title, body, tags, created_at FROM notes WHERE id = ?").get(id) as
      | Note
      | undefined;
    if (!note) {
      throw new Error(`note ${id} was not found`);
    }
    return note;
  }

  readRecord(input: { table: string; id: number }): Task | Note | RecordRow {
    assertPositiveId(input.id);
    if (!isReadableTable(input.table)) {
      throw new Error(`table must be one of: ${Object.keys(READ_RECORD_QUERIES).join(", ")}`);
    }
    const row = this.db.prepare(READ_RECORD_QUERIES[input.table]).get(input.id) as
      | Task
      | Note
      | RecordRow
      | undefined;
    if (!row) {
      throw new Error(`${input.table} record ${input.id} was not found`);
    }
    return row;
  }

  taskSummary(input: { project?: string }): {
    total: number;
    by_status: Record<string, number>;
    high_priority_open: Task[];
    matching_project?: string;
  } {
    const tasks = this.db
      .prepare(
        "SELECT id, title, status, priority, project, due_date, created_at FROM tasks WHERE (? IS NULL OR project = ?) ORDER BY id"
      )
      .all(input.project ?? null, input.project ?? null) as Task[];
    const byStatus = tasks.reduce<Record<string, number>>((counts, task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
      return counts;
    }, {});
    const highPriorityOpen = tasks
      .filter((task) => task.priority === "high" && task.status !== "done")
      .slice(0, 10);
    return {
      total: tasks.length,
      by_status: byStatus,
      high_priority_open: highPriorityOpen,
      matching_project: input.project
    };
  }
}
