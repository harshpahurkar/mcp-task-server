export type Tool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  annotations: Record<string, boolean>;
};

export type ToolResponse = {
  tool: string;
  input: unknown;
  content: Array<{ type: string; text: string }>;
  result: unknown;
};

export type Health = {
  status: string;
  runtime: string;
  database: string;
  read_only: boolean;
  tools: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  tools: () => request<{ tools: Tool[] }>("/api/tools"),
  callTool: (name: string, input: unknown) =>
    request<ToolResponse>(`/api/tools/${name}`, { method: "POST", body: JSON.stringify(input) })
};
