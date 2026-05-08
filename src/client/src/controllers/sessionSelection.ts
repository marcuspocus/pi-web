import type { SessionInfo } from "../api";

export type ArchiveSelectionChange =
  | { type: "unchanged" }
  | { type: "select"; session: SessionInfo }
  | { type: "clear" };

export function markSessionArchived(sessions: SessionInfo[], sessionId: string, archivedAt: string): SessionInfo[] {
  return sessions.map((session) => session.id === sessionId ? { ...session, archived: true, archivedAt } : session);
}

export function selectionAfterArchivingSession(sessions: SessionInfo[], selectedSessionId: string | undefined, archivedSessionId: string): ArchiveSelectionChange {
  if (selectedSessionId !== archivedSessionId) return { type: "unchanged" };

  const nextSession = sessions.find((session) => session.id !== archivedSessionId && session.archived !== true);
  return nextSession === undefined ? { type: "clear" } : { type: "select", session: nextSession };
}
