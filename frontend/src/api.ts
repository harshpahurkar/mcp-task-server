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

export class ApiError extends Error {
  constructor(message: string, readonly payload: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return String(payload || "Request failed");
  }
  const value = payload as { error?: unknown; issues?: Array<{ path?: Array<string | number>; message?: string }> };
  if (value.error === "Validation failed" && Array.isArray(value.issues)) {
    return value.issues
      .map((issue) => `${issue.path?.join(".") || "input"}: ${issue.message ?? "invalid"}`)
      .join("; ");
  }
  if (typeof value.error === "string") {
    return value.error;
  }
  return JSON.stringify(payload, null, 2);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new ApiError(errorMessage(payload), payload);
  }
  return payload as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  tools: () => request<{ tools: Tool[] }>("/api/tools"),
  callTool: (name: string, input: unknown) =>
    request<ToolResponse>(`/api/tools/${name}`, { method: "POST", body: JSON.stringify(input) })
};
