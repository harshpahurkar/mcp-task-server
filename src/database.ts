import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

type DatabaseConstructor = new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
  close(): void;
};

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: DatabaseConstructor };

export function defaultDatabasePath(): string {
  return resolve(process.cwd(), "data", "tasks.sqlite");
}

export class DatabaseManager {
  readonly db: InstanceType<DatabaseConstructor>;

  constructor(path = defaultDatabasePath()) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.ensureSchema();
    this.seedIfEmpty();
  }

  close(): void {
    this.db.close();
  }

  private ensureSchema(): void {
    this.runInTransaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'blocked', 'done')),
          priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
          project TEXT NOT NULL,
          due_date TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON tasks(status, id);
        CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project, id);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority_status ON tasks(priority, status);
        CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_notes_body ON notes(body COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes(tags COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_records_kind_key ON records(kind, key);
      `);
    });
  }

  private seedIfEmpty(): void {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number };
    if (row.count > 0) {
      return;
    }

    this.runInTransaction(() => {
      const insertTask = this.db.prepare(
        "INSERT INTO tasks (title, status, priority, project, due_date) VALUES (?, ?, ?, ?, ?)"
      );
      [
        ["Draft RAG eval report", "in_progress", "high", "rag-platform", "2026-02-12"],
        ["Review MCP tool validation", "todo", "high", "mcp-server", "2026-01-18"],
        ["Document Cursor client config", "done", "medium", "mcp-server", "2026-01-20"],
        ["Check Redis cache behavior", "blocked", "medium", "research-system", null],
        ["Polish README examples", "todo", "low", "portfolio", null]
      ].forEach((task) => insertTask.run(...task));

      const insertNote = this.db.prepare("INSERT INTO notes (title, body, tags) VALUES (?, ?, ?)");
      [
        [
          "MCP validation notes",
          "Reject unknown tables, invalid IDs, oversized limits, and empty search queries before reading from SQLite.",
          "mcp,validation,sqlite"
        ],
        [
          "Cursor smoke test",
          "Use a stdio client to list tools and call list_tasks so failed tool calls are caught before demo day.",
          "cursor,stdio,testing"
        ],
        [
          "Read-only policy",
          "The server exposes read-only tools by default to reduce agent side-effect risk.",
          "security,agents"
        ]
      ].forEach((note) => insertNote.run(...note));

      const insertRecord = this.db.prepare("INSERT INTO records (kind, key, value) VALUES (?, ?, ?)");
      [
        ["setting", "owner", "Harsh"],
        ["setting", "default_limit", "10"],
        ["metric", "seed_tasks", "5"],
        ["metric", "seed_notes", "3"]
      ].forEach((record) => insertRecord.run(...record));
    });
  }

  private runInTransaction(operation: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      operation();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
