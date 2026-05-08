import { describe, expect, it } from "vitest";
import type { SessionInfo } from "../api";
import { markSessionArchived, selectionAfterArchivingSession } from "./sessionSelection";

describe("markSessionArchived", () => {
  it("marks the matching session archived without mutating the original", () => {
    const sessions = [testSession("s1"), testSession("s2")];

    const next = markSessionArchived(sessions, "s1", "later");

    expect(next).toEqual([{ ...sessions[0], archived: true, archivedAt: "later" }, sessions[1]]);
    expect(sessions[0]?.archived).toBeUndefined();
  });
});

describe("selectionAfterArchivingSession", () => {
  it("leaves selection unchanged when archiving an unselected session", () => {
    expect(selectionAfterArchivingSession([testSession("s1"), testSession("s2")], "s1", "s2")).toEqual({ type: "unchanged" });
  });

  it("selects the first active session when archiving the selected session", () => {
    const s2 = testSession("s2");

    expect(selectionAfterArchivingSession([testSession("s1"), s2], "s1", "s1")).toEqual({ type: "select", session: s2 });
  });

  it("skips archived sessions when choosing the next selected session", () => {
    const s3 = testSession("s3");

    expect(selectionAfterArchivingSession([testSession("s1"), { ...testSession("s2"), archived: true }, s3], "s1", "s1")).toEqual({ type: "select", session: s3 });
  });

  it("clears selection when no active session remains", () => {
    expect(selectionAfterArchivingSession([testSession("s1")], "s1", "s1")).toEqual({ type: "clear" });
  });
});

function testSession(id: string): SessionInfo {
  return { id, path: `/tmp/project/.pi/sessions/${id}`, cwd: "/tmp/project", created: "now", modified: "now", messageCount: 0, firstMessage: "" };
}
