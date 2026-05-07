export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  projectId: string;
  path: string;
  label: string;
  branch?: string;
  isMain: boolean;
  isGitWorktree: boolean;
}

export interface SessionInfo {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export const api = {
  projects: () => request<Project[]>("/api/projects"),
  addProject: (path: string, name?: string) => request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ path, name }) }),
  workspaces: (projectId: string) => request<Workspace[]>(`/api/projects/${projectId}/workspaces`),
  sessions: (cwd: string) => request<SessionInfo[]>(`/api/sessions?cwd=${encodeURIComponent(cwd)}`),
  startSession: (cwd: string) => request<SessionInfo>("/api/sessions", { method: "POST", body: JSON.stringify({ cwd }) }),
  messages: (sessionId: string) => request<any[]>(`/api/sessions/${sessionId}/messages`),
  prompt: (sessionId: string, text: string) => request<{ accepted: true }>(`/api/sessions/${sessionId}/prompt`, { method: "POST", body: JSON.stringify({ text }) }),
  close: (sessionId: string) => request<{ closed: true }>(`/api/sessions/${sessionId}/close`, { method: "POST" }),
};

export function sessionEvents(sessionId: string): WebSocket {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${location.host}/api/sessions/${sessionId}/events`);
}
