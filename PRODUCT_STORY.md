# Agent Ledger Console Product Story

## Why this app exists

AI agents are useful only when they can safely read the local context they need. The risky part is giving an LLM too much access to files or databases. Agent Ledger Console exists to show a safer pattern: typed, read-only tools over local tasks, notes, and SQLite records, with validation failures visible before an agent can treat bad output as context.

## Target user

An engineer wiring AI agents into local project data who needs to answer:

- What tools can the agent call?
- What schema does each tool enforce?
- Can the agent read useful task and note data?
- Are unsafe table names, invalid IDs, empty queries, and bad enums rejected?
- Can this run through stdio MCP clients and still be demonstrated in a browser?

## Utility

Agent Ledger Console gives the project a visible safety and data-access story. The user can inspect tools, run calls, browse seeded SQLite data, and intentionally trigger invalid calls from a safety lab.

The convenience is confidence: instead of claiming "typed MCP tools," the app shows the schema, the tool call, the response, and the rejection path in one place.

## Product personality

Ledger-like, cautious, and precise. The UI should feel like a control room for safe local data access, with read-only badges and validation feedback more prominent than decoration.

Design cues:

- Tool schemas are visible.
- Read-only annotations are repeated in the UI.
- Invalid calls are treated as successful safety demonstrations.
- MCP-like transcripts make the agent integration concrete.

## Interview pitch

"I built this because local agent tooling needs guardrails. Agent Ledger exposes tasks, notes, and SQLite records through typed MCP tools, but it stays read-only and rejects malformed calls. The browser console is a demo bridge over the same repository and validation logic, while the real runtime remains stdio for Cursor-style clients."

## Demo path

1. Open the tool catalog and show the six read-only tools.
2. Run `list_tasks` and show SQLite task rows.
3. Search notes and show the MCP-like JSON response.
4. Trigger `read_record` with an unsafe table name.
5. Explain why the rejection is a feature, not a failure.
6. Run the stdio smoke client or Docker smoke path to prove real MCP runtime behavior.
