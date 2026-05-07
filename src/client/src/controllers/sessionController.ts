import { api, type SessionInfo } from "../api";
import { appendText, normalizeMessages, textMessage } from "../chatMessages";
import { SessionSocket, type SessionUiEvent } from "../sessionSocket";
import type { GetState, SetState, UpdateUrl } from "./types";

export class SessionController {
  private readonly socket = new SessionSocket();

  constructor(private readonly getState: GetState, private readonly setState: SetState, private readonly updateUrl: UpdateUrl) {}

  dispose() {
    this.socket.close();
  }

  clearActiveSession() {
    this.socket.close();
    this.setState({ selectedSession: undefined, messages: [], status: undefined });
  }

  async startSession() {
    const workspace = this.getState().selectedWorkspace;
    if (!workspace) return;
    try {
      const session = await api.startSession(workspace.path);
      this.setState({ sessions: [session, ...this.getState().sessions] });
      await this.selectSession(session);
    } catch (error) {
      this.setState({ error: String(error) });
    }
  }

  async selectSession(session: SessionInfo, options?: { updateUrl?: boolean }) {
    this.socket.close();
    try {
      this.setState({ selectedSession: session, messages: normalizeMessages(await api.messages(session.id)), status: await api.status(session.id) });
      this.socket.connect(session.id, (event) => this.applyEvent(event));
      if (options?.updateUrl !== false) this.updateUrl();
    } catch (error) {
      this.setState({ error: String(error) });
    }
  }

  async send(text: string) {
    const session = this.getState().selectedSession;
    if (!session) return;
    this.setState({ messages: [...this.getState().messages, textMessage("user", text)] });
    try {
      await api.prompt(session.id, text);
    } catch (error) {
      this.setState({ error: String(error) });
    }
  }

  async closeSession() {
    const session = this.getState().selectedSession;
    if (!session) return;
    try {
      await api.close(session.id);
    } catch (error) {
      this.setState({ error: String(error) });
    } finally {
      this.clearActiveSession();
      this.updateUrl();
    }
  }

  private applyEvent(event: SessionUiEvent) {
    const messages = this.getState().messages;
    if (event.type === "assistant.delta") {
      this.setState({ messages: appendText(messages, "assistant", event.text) });
    } else if (event.type === "tool.start") {
      this.setState({ messages: [...messages, { role: "tool", parts: [{ type: "toolCall", toolName: event.toolName, summary: "" }] }] });
    } else if (event.type === "tool.end") {
      this.setState({ messages: [...messages, textMessage("tool", `${event.isError ? "✖" : "✓"} ${event.toolName}`)] });
    } else if (event.type === "status.update") {
      this.setState({ status: event.status });
    } else if (event.type === "session.error") {
      this.setState({ messages: [...messages, textMessage("system", event.message)] });
    }
  }
}
