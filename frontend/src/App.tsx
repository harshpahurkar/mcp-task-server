import {
  AlertTriangle,
  Archive,
  BookOpenText,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  FileJson,
  KeyRound,
  Loader2,
  LockKeyhole,
  Play,
  Search,
  ShieldCheck,
  Table2,
  TerminalSquare
} from "lucide-react";
import React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, api, ToolResponse } from "./api";

type Transcript = {
  label: string;
  ok: boolean;
  payload: unknown;
};

const toolOrder = ["list_tasks", "get_task", "search_notes", "get_note", "read_record", "task_summary"];
const navItems = [
  { id: "tools", label: "Read-only tools", icon: Archive },
  { id: "runner", label: "Run a call", icon: TerminalSquare },
  { id: "safety", label: "Break it safely", icon: ShieldCheck },
  { id: "data", label: "Browse data", icon: Table2 },
  { id: "transcript", label: "Call transcript", icon: Code2 }
];
const navIds = navItems.map((item) => item.id);
const sampleInputs: Record<string, unknown> = {
  list_tasks: { status: "todo", limit: 10 },
  get_task: { id: 2 },
  search_notes: { query: "validation", limit: 5 },
  get_note: { id: 1 },
  read_record: { table: "records", id: 1 },
  task_summary: { project: "mcp-server" }
};

const defaultFormValues: Record<string, Record<string, string>> = {
  list_tasks: { status: "todo", limit: "10" },
  get_task: { id: "2" },
  search_notes: { query: "validation", limit: "5" },
  get_note: { id: "1" },
  read_record: { table: "records", id: "1" },
  task_summary: { project: "mcp-server" }
};

const safetyPresets = [
  { label: "Unsafe table", name: "read_record", input: { table: "sqlite_master", id: 1 } },
  { label: "Invalid ID", name: "get_task", input: { id: 0 } },
  { label: "Empty query", name: "search_notes", input: { query: "", limit: 5 } },
  { label: "Bad status", name: "list_tasks", input: { status: "paused", limit: 10 } },
  { label: "Oversized limit", name: "list_tasks", input: { status: "todo", limit: 500 } }
];

function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target.id) {
          setActive(visible.target.id);
        }
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0.1, 0.35, 0.6] }
    );

    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
}) {
  return (
    <section className="metric-card">
      <div className="metric-icon"><Icon size={18} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <section className="metric-card skeleton-card" aria-label="Loading status">
      <span className="skeleton skeleton-icon" />
      <div>
        <span className="skeleton skeleton-line short" />
        <span className="skeleton skeleton-line large" />
        <span className="skeleton skeleton-line" />
      </div>
    </section>
  );
}

function SkeletonTool() {
  return (
    <article className="tool-card skeleton-card" aria-label="Loading tool">
      <span className="skeleton skeleton-line" />
      <span className="skeleton skeleton-line short" />
      <span className="skeleton skeleton-block" />
    </article>
  );
}

function JsonPanel({ title, value, tone = "normal" }: { title: string; value: unknown; tone?: "normal" | "error" }) {
  return (
    <section className={`json-panel ${tone}`}>
      <div className="panel-title">{title}</div>
      <pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function inputFromFields(tool: string, values: Record<string, string>): unknown {
  switch (tool) {
    case "list_tasks":
      return { status: values.status || undefined, limit: Number(values.limit || 10) };
    case "get_task":
    case "get_note":
      return { id: Number(values.id || 0) };
    case "search_notes":
      return { query: values.query ?? "", limit: Number(values.limit || 10) };
    case "read_record":
      return { table: values.table || "records", id: Number(values.id || 0) };
    case "task_summary":
      return values.project?.trim() ? { project: values.project.trim() } : {};
    default:
      return sampleInputs[tool] ?? {};
  }
}

function transcriptError(error: unknown) {
  if (error instanceof ApiError) {
    return { message: error.message, response: error.payload };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

function ToolInputFields({
  tool,
  values,
  onChange
}: {
  tool: string;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  function setValue(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }
  if (tool === "list_tasks") {
    return (
      <div className="generated-fields">
        <div>
          <label htmlFor="statusInput">Status</label>
          <select id="statusInput" value={values.status ?? "todo"} onChange={(event) => setValue("status", event.target.value)}>
            <option value="todo">todo</option>
            <option value="in_progress">in_progress</option>
            <option value="blocked">blocked</option>
            <option value="done">done</option>
          </select>
        </div>
        <NumberField id="limitInput" label="Limit" value={values.limit ?? "10"} min={1} max={50} onChange={(value) => setValue("limit", value)} />
      </div>
    );
  }
  if (tool === "get_task" || tool === "get_note") {
    return <NumberField id="idInput" label="Record ID" value={values.id ?? "1"} min={1} onChange={(value) => setValue("id", value)} />;
  }
  if (tool === "search_notes") {
    return (
      <div className="generated-fields">
        <div>
          <label htmlFor="queryInput">Query</label>
          <input id="queryInput" value={values.query ?? ""} onChange={(event) => setValue("query", event.target.value)} />
        </div>
        <NumberField id="noteLimitInput" label="Limit" value={values.limit ?? "5"} min={1} max={50} onChange={(value) => setValue("limit", value)} />
      </div>
    );
  }
  if (tool === "read_record") {
    return (
      <div className="generated-fields">
        <div>
          <label htmlFor="tableInput">Table</label>
          <select id="tableInput" value={values.table ?? "records"} onChange={(event) => setValue("table", event.target.value)}>
            <option value="tasks">tasks</option>
            <option value="notes">notes</option>
            <option value="records">records</option>
          </select>
        </div>
        <NumberField id="recordIdInput" label="Record ID" value={values.id ?? "1"} min={1} onChange={(value) => setValue("id", value)} />
      </div>
    );
  }
  return (
    <div>
      <label htmlFor="projectInput">Project filter</label>
      <input id="projectInput" value={values.project ?? ""} onChange={(event) => setValue("project", event.target.value)} />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function statusClass(status: string) {
  return `badge status-${status.replace(/_/g, "-")}`;
}

export default function App() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 5000 });
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const [transcripts, setTranscripts] = React.useState<Transcript[]>([]);
  const [selectedTool, setSelectedTool] = React.useState("list_tasks");
  const [runnerValues, setRunnerValues] = React.useState(defaultFormValues.list_tasks);
  const [runnerInput, setRunnerInput] = React.useState(JSON.stringify(sampleInputs.list_tasks, null, 2));
  const [useRawInput, setUseRawInput] = React.useState(false);
  const activeSection = useActiveSection(navIds);

  function dismissGuide() {
    localStorage.setItem("agent-ledger:start-guide", "hidden");
  }

  const callTool = useMutation({
    mutationFn: ({ name, input }: { name: string; input: unknown }) => api.callTool(name, input),
    onSuccess: (payload) => {
      dismissGuide();
      setTranscripts((current) => [{ label: payload.tool, ok: true, payload }, ...current].slice(0, 8));
    },
    onError: (error, variables) => {
      dismissGuide();
      setTranscripts((current) => [
        { label: variables.name, ok: false, payload: transcriptError(error) },
        ...current
      ].slice(0, 8));
    }
  });

  const latestResult = transcripts.find((item) => item.ok)?.payload as ToolResponse | undefined;
  const latestRejected = transcripts.find((item) => !item.ok);
  const taskRows = latestResult?.tool === "list_tasks" && Array.isArray(latestResult.result) ? latestResult.result : [];
  const orderedTools = toolOrder
    .map((name) => tools.data?.tools.find((tool) => tool.name === name))
    .filter(Boolean) as NonNullable<typeof tools.data>["tools"];
  const backendError = health.error || tools.error;

  function chooseTool(name: string) {
    setSelectedTool(name);
    setRunnerValues(defaultFormValues[name] ?? {});
    setRunnerInput(JSON.stringify(sampleInputs[name] ?? {}, null, 2));
  }

  function runSelectedTool() {
    try {
      callTool.mutate({ name: selectedTool, input: useRawInput ? JSON.parse(runnerInput) : inputFromFields(selectedTool, runnerValues) });
    } catch (error) {
      setTranscripts((current) => [
        { label: selectedTool, ok: false, payload: error instanceof Error ? error.message : String(error) },
        ...current
      ].slice(0, 8));
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="brand-icon"><LockKeyhole size={22} /></div>
          <div>
            <p>Agent Ledger</p>
            <h1>Console</h1>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <a href={`#${item.id}`} key={item.id} className={activeSection === item.id ? "active" : undefined}>
              <item.icon size={17} /> {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-card">
          <ShieldCheck size={18} />
          <span>Every tool call the AI agent makes goes through here. Every one is read-only. Try an unsafe call and watch it get rejected.</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Safe local-data MCP console</span>
            <h1>Agent Ledger Console</h1>
            <p>Run one allowed read, then one forbidden call. The transcript should prove the agent can inspect data without mutating it.</p>
          </div>
          <div className="status-pill">
            <span className={health.data?.status === "ok" ? "dot ok" : "dot"} />
            {backendError ? "Bridge offline" : `${health.data?.runtime ?? "Connecting"} / read-only`}
          </div>
        </header>

        {backendError && (
          <section className="runtime-failure" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Local bridge request failed.</strong>
              <span>{backendError instanceof Error ? backendError.message : String(backendError)}</span>
            </div>
          </section>
        )}

        <section className="proof-grid">
          <article className="proof-card safe">
            <span className="eyebrow">Allowed path</span>
            <h2>Read tasks</h2>
            <p>Calls `list_tasks` through the same repository and validation layer as the MCP server.</p>
            <button className="primary" onClick={() => callTool.mutate({ name: "list_tasks", input: inputFromFields("list_tasks", defaultFormValues.list_tasks) })}>
              <Play size={16} /> Run safe read
            </button>
          </article>
          <article className="proof-card blocked">
            <span className="eyebrow">Forbidden path</span>
            <h2>Reject unsafe table</h2>
            <p>Sends `sqlite_master` to `read_record`; the table allowlist should block it before SQL runs.</p>
            <button className="danger" onClick={() => callTool.mutate({ name: "read_record", input: { table: "sqlite_master", id: 1 } })}>
              <AlertTriangle size={16} /> Try unsafe call
            </button>
          </article>
          <article className="proof-card result">
            <span className="eyebrow">Last rejection</span>
            <h2>{latestRejected ? latestRejected.label : "No bad call yet"}</h2>
            <p>{latestRejected ? (latestRejected.payload as { message?: string }).message ?? "Rejected by the bridge." : "Trigger the forbidden path to prove validation is active."}</p>
          </article>
        </section>

        <details className="card panel protocol-details" id="tools">
          <summary>
            <span>
              <span className="eyebrow">Protocol details</span>
              <strong>Tool catalog and read-only annotations</strong>
            </span>
            <Archive size={18} />
          </summary>
          <div className="trust-strip">
            <LockKeyhole size={17} />
            <div>
              <strong>Every tool is annotated read-only at the MCP protocol level.</strong>
              <span>The smoke client asserts readOnlyHint: true for all six tools, so the contract fails loudly if a write tool slips in.</span>
            </div>
          </div>
          <div className="tool-grid">
            {tools.isPending && !tools.data ? (
              Array.from({ length: 6 }).map((_, index) => <SkeletonTool key={index} />)
            ) : (
              (tools.data?.tools ?? []).map((tool) => (
                <article className="tool-card" key={tool.name}>
                  <div>
                    <strong>{tool.name}</strong>
                    <span><LockKeyhole size={13} /> read-only</span>
                  </div>
                  <p>{tool.description}</p>
                  <pre>{JSON.stringify(tool.schema, null, 2)}</pre>
                </article>
              ))
            )}
          </div>
        </details>

        <section className="two-column">
          <section className="card panel" id="runner">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Tool Runner</span>
                <h2>Agent-call controls</h2>
              </div>
              {callTool.isPending && <Loader2 className="spin muted-icon" size={18} />}
            </div>
            <div className="runner-editor">
              <div>
                <label htmlFor="toolSelect">Tool</label>
                <select id="toolSelect" value={selectedTool} onChange={(event) => chooseTool(event.target.value)}>
                  {orderedTools.map((tool) => (
                    <option value={tool.name} key={tool.name}>{tool.name}</option>
                  ))}
                </select>
              </div>
              <ToolInputFields tool={selectedTool} values={runnerValues} onChange={setRunnerValues} />
              <label className="toggle-row">
                <input type="checkbox" checked={useRawInput} onChange={(event) => setUseRawInput(event.target.checked)} />
                Use raw JSON
              </label>
              {useRawInput && (
                <div>
                  <label htmlFor="toolInput">Input JSON</label>
                  <textarea id="toolInput" value={runnerInput} onChange={(event) => setRunnerInput(event.target.value)} />
                </div>
              )}
              <button className="primary" onClick={runSelectedTool}>
                <Play size={16} /> Run selected tool
              </button>
            </div>
            <div className="button-grid compact-buttons">
              <button className="secondary" onClick={() => chooseTool("get_task")}>
                <KeyRound size={16} /> Load get_task
              </button>
              <button className="secondary" onClick={() => chooseTool("search_notes")}>
                <Search size={16} /> Load search_notes
              </button>
              <button className="secondary" onClick={() => chooseTool("get_note")}>
                <BookOpenText size={16} /> Load get_note
              </button>
              <button className="secondary" onClick={() => chooseTool("read_record")}>
                <FileJson size={16} /> Load read_record
              </button>
              <button className="secondary" onClick={() => chooseTool("task_summary")}>
                <BookOpenText size={16} /> Load summary
              </button>
            </div>
          </section>

          <section className="card panel" id="safety">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Safety Lab</span>
                <h2>Bad calls should fail</h2>
              </div>
            </div>
            <p className="section-copy">Click any preset to send an intentionally invalid call and watch the server reject it in real time.</p>
            <div className="button-grid">
              {safetyPresets.map((preset) => (
                <button className="danger" key={preset.label} onClick={() => callTool.mutate({ name: preset.name, input: preset.input })}>
                  <AlertTriangle size={16} /> {preset.label}
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="card panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Protocol guarantee</span>
              <h2>Six tools, zero write surface</h2>
            </div>
          </div>
          <p className="section-copy">The visual proof is intentionally boring: every exposed tool advertises readOnlyHint: true, and there are no mutation tools hiding elsewhere.</p>
          <div className="read-only-grid">
            {orderedTools.map((tool) => (
              <article className="read-only-card" key={tool.name}>
                <LockKeyhole size={16} />
                <strong>{tool.name}</strong>
                <span>readOnlyHint: true</span>
              </article>
            ))}
            {!orderedTools.length && <div className="empty-state">Waiting for the local bridge to publish tool annotations.</div>}
          </div>
        </section>

        <section className="card panel" id="data">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Data Browser</span>
              <h2>SQLite task records</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Project</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.length ? taskRows.map((task) => (
                  <tr key={String((task as { id: number }).id)}>
                    <td>{String((task as { id: number }).id)}</td>
                    <td>{String((task as { title: string }).title)}</td>
                    <td><span className={statusClass(String((task as { status: string }).status))}>{String((task as { status: string }).status)}</span></td>
                    <td>{String((task as { priority: string }).priority)}</td>
                    <td>{String((task as { project: string }).project)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}><div className="table-empty">Run list_tasks from the Tool Runner. The SQLite rows will appear here without giving the agent write access.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card panel" id="transcript">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Agent Transcript</span>
              <h2>MCP-like request and response blocks</h2>
            </div>
          </div>
          <div className="trace-grid">
            {transcripts.map((item, index) => (
              <JsonPanel key={`${item.label}-${index}`} title={`${item.ok ? "ok" : "rejected"}: ${item.label}`} tone={item.ok ? "normal" : "error"} value={item.payload} />
            ))}
            {!transcripts.length && <div className="empty-state">Run a safe tool or trigger the Safety Lab. Accepted calls stay neutral; rejected calls turn red so failures are visible in a demo.</div>}
          </div>
        </section>
      </section>
    </main>
  );
}
