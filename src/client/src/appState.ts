import type { Project, SessionInfo, SessionStatus, Workspace } from "./api";
import type { ChatLine } from "./components/shared";

export interface AppState {
  projects: Project[];
  workspaces: Workspace[];
  sessions: SessionInfo[];
  messages: ChatLine[];
  selectedProject?: Project;
  selectedWorkspace?: Workspace;
  selectedSession?: SessionInfo;
  status?: SessionStatus;
  error: string;
}

export function initialAppState(): AppState {
  return {
    projects: [],
    workspaces: [],
    sessions: [],
    messages: [],
    error: "",
  };
}
