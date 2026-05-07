import type { AppState } from "../appState";

export type GetState = () => AppState;
export type SetState = (patch: Partial<AppState>) => void;
export type UpdateUrl = () => void;

export interface RouteTarget {
  workspaceId?: string;
  sessionId?: string;
  updateUrl?: boolean;
}
