export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  project: string;
  due_date: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  tags: string;
  created_at: string;
}

export interface RecordRow {
  id: number;
  kind: string;
  key: string;
  value: string;
  created_at: string;
}
