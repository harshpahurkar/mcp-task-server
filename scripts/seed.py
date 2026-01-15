from __future__ import annotations

import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "tasks.sqlite"


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            conn.executescript(
                """
                BEGIN IMMEDIATE;

                DROP TABLE IF EXISTS tasks;
                DROP TABLE IF EXISTS notes;
                DROP TABLE IF EXISTS records;

                CREATE TABLE tasks (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  status TEXT NOT NULL CHECK(status IN ('todo', 'in_progress', 'blocked', 'done')),
                  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
                  project TEXT NOT NULL,
                  due_date TEXT,
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE notes (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  body TEXT NOT NULL,
                  tags TEXT NOT NULL DEFAULT '',
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE records (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  kind TEXT NOT NULL,
                  key TEXT NOT NULL,
                  value TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            conn.executemany(
                "INSERT INTO tasks (title, status, priority, project, due_date) VALUES (?, ?, ?, ?, ?)",
                [
                    ("Draft RAG eval report", "in_progress", "high", "rag-platform", "2026-02-12"),
                    ("Review MCP tool validation", "todo", "high", "mcp-server", "2026-01-18"),
                    ("Document Cursor client config", "done", "medium", "mcp-server", "2026-01-20"),
                    ("Check Redis cache behavior", "blocked", "medium", "research-system", None),
                    ("Polish README examples", "todo", "low", "portfolio", None),
                ],
            )
            conn.executemany(
                "INSERT INTO notes (title, body, tags) VALUES (?, ?, ?)",
                [
                    (
                        "MCP validation notes",
                        "Reject unknown tables, invalid IDs, oversized limits, and empty search queries before reading from SQLite.",
                        "mcp,validation,sqlite",
                    ),
                    (
                        "Cursor smoke test",
                        "Use a stdio client to list tools and call list_tasks so failed tool calls are caught before demo day.",
                        "cursor,stdio,testing",
                    ),
                    (
                        "Read-only policy",
                        "The server exposes read-only tools by default to reduce agent side-effect risk.",
                        "security,agents",
                    ),
                ],
            )
            conn.executemany(
                "INSERT INTO records (kind, key, value) VALUES (?, ?, ?)",
                [
                    ("setting", "owner", "Harsh"),
                    ("setting", "default_limit", "10"),
                    ("metric", "seed_tasks", "5"),
                    ("metric", "seed_notes", "3"),
                ],
            )
    finally:
        conn.close()
    print(f"Seeded {DB_PATH}")


if __name__ == "__main__":
    main()
