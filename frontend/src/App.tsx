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
import { api, ToolResponse } from "./api";

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

export default function App() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 5000 });
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const [transcripts, setTranscripts] = React.useState<Transcript[]>([]);
  const [selectedTool, setSelectedTool] = React.useState("list_tasks");
  const [runnerInput, setRunnerInput] = React.useState(JSON.stringify(sampleInputs.list_tasks, null, 2));
  const [guideVisible, setGuideVisible] = React.useState(() => localStorage.getItem("agent-ledger:start-guide") !== "hidden");
  const activeSection = useActiveSection(navIds);

  function dismissGuide() {
    localStorage.setItem("agent-ledger:start-guide", "hidden");
    setGuideVisible(false);
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
        { label: variables.name, ok: false, payload: error instanceof Error ? error.message : String(error) },
        ...current
      ].slice(0, 8));
    }
  });

  const latestResult = transcripts.find((item) => item.ok)?.payload as ToolResponse | undefined;
  const taskRows = latestResult?.tool === "list_tasks" && Array.isArray(latestResult.result) ? latestResult.result : [];
  const firstLoad = (health.isPending || tools.isPending) && !health.data && !tools.data && transcripts.length === 0;
  const orderedTools = toolOrder
    .map((name) => tools.data?.tools.find((tool) => tool.name === name))
    .filter(Boolean) as NonNullable<typeof tools.data>["tools"];

  function chooseTool(name: string) {
    setSelectedTool(name);
    setRunnerInput(JSON.stringify(sampleInputs[name] ?? {}, null, 2));
  }

  function runEditableTool() {
    try {
      callTool.mutate({ name: selectedTool, input: JSON.parse(runnerInput) });
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
            <p>AI agents should read your local task data without being able to change it. Run a safe call, then try to break the rules.</p>
          </div>
          <div className="status-pill">
            <span className={health.data?.status === "ok" ? "dot ok" : "dot"} />
            {health.data?.runtime ?? "Connecting"} / read-only
          </div>
        </header>

        {guideVisible && transcripts.length === 0 && (
          <section className="start-guide">
            <div>
              <span className="eyebrow">Start here</span>
              <h2>Prove the agent cannot mutate data</h2>
              <p>Run a safe task read, then send an intentionally bad call. The transcript should show one success and one red rejection.</p>
            </div>
            <button className="primary" onClick={runEditableTool}>
              <Play size={16} /> Run list_tasks
            </button>
            <button className="danger" onClick={() => callTool.mutate({ name: "read_record", input: { table: "sqlite_master", id: 1 } })}>
              <AlertTriangle size={16} /> Try unsafe table
            </button>
          </section>
        )}

        <section className="metric-grid">
          {firstLoad ? (
            Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
          ) : (
            <>
              <StatCard icon={Archive} label="Registered tools" value={tools.data ? String(tools.data.tools.length) : "--"} detail="Every tool has a typed input schema." />
              <StatCard icon={Database} label="Runtime" value={health.data?.runtime ?? "--"} detail={health.data ? "HTTP bridge over the MCP repository." : "Waiting for the local bridge."} />
              <StatCard icon={ShieldCheck} label="Mutation tools" value="0" detail="No write tools are exposed." />
              <StatCard icon={AlertTriangle} label="Safety presets" value={String(safetyPresets.length)} detail="Click one to prove rejection." />
            </>
          )}
        </section>

        <section className="card panel" id="tools">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Tool Catalog</span>
              <h2>Typed read-only tools</h2>
            </div>
          </div>
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
        </section>

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
              <div>
                <label htmlFor="toolInput">Input JSON</label>
                <textarea id="toolInput" value={runnerInput} onChange={(event) => setRunnerInput(event.target.value)} />
              </div>
              <button className="primary" onClick={runEditableTool}>
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
                    <td><span className="badge">{String((task as { status: string }).status)}</span></td>
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
        <footer className="portfolio-footer">Part of an AI ops portfolio built around one idea: you can&apos;t trust what you can&apos;t see.</footer>
      </section>
    </main>
  );
}
