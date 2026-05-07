export interface AppRoute {
  projectId?: string;
  workspaceId?: string;
  sessionId?: string;
}

export function readRoute(): AppRoute {
  const params = new URLSearchParams(window.location.search);
  return {
    projectId: params.get("project") ?? undefined,
    workspaceId: params.get("workspace") ?? undefined,
    sessionId: params.get("session") ?? undefined,
  };
}

export function writeRoute(route: AppRoute): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("project");
  url.searchParams.delete("workspace");
  url.searchParams.delete("session");
  if (route.projectId) url.searchParams.set("project", route.projectId);
  if (route.workspaceId) url.searchParams.set("workspace", route.workspaceId);
  if (route.sessionId) url.searchParams.set("session", route.sessionId);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.pushState({}, "", url);
}
