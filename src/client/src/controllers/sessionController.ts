import { api, type CommandResult, type SessionActivity, type SessionInfo, type SessionStatus } from "../api";
import { appendText, normalizeMessages, textMessage } from "../chatMessages";
import { GlobalSessionSocket, SessionSocket, type SessionUiEvent } from "../sessionSocket";
import type { ChatLine, ChatPart } from "../components/shared";
import type { GetState, SetState, UpdateUrl } from "./types";

export class SessionController {
  private readonly socket = new SessionSocket();
  private readonly globalSocket = new GlobalSessionSocket();

  constructor(private readonly getState: GetState, private readonly setState: SetState, private readonly updateUrl: UpdateUrl) {}

  connectStatusUpdates() {
    this.globalSocket.connect((event) => {
      if (event.type === "status.update") this.applyStatus(event.status);
      else this.applyActivity(event.activity);
    });
  }

  dispose() {
    this.socket.close();
    this.globalSocket.close();
  }

  clearActiveSession() {
    this.socket.close();
    this.setState({ selectedSession: undefined, messages: [], status: undefined, activity: undefined });
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
      const buffered: SessionUiEvent[] = [];
      this.socket.connect(session.id, (event) => buffered.push(event));
      const [messages, status] = await Promise.all([api.messages(session.id), api.status(session.id)]);
      this.setState({ selectedSession: session, messages: normalizeMessages(messages), status });
      this.applyStatus(status);
      for (const event of buffered) this.applyEvent(event);
      this.socket.setHandler((event) => this.applyEvent(event));
      if (options?.updateUrl !== false) this.updateUrl();
    } catch (error) {
      this.setState({ error: String(error) });
    }
  }

  async send(text: string) {
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) return this.runCommand(text);
    if (trimmed.startsWith("!")) return this.runShell(text);
    const session = this.getState().selectedSession;
    if (!session) return;
    this.setState({ messages: [...this.getState().messages, textMessage("user", text)] });
    try {
      await api.prompt(session.id, text);
    } catch (error) {
      this.setState({ error: String(error) });
    }
  }

  async runShell(text: string) {
    const session = this.getState().selectedSession;
    if (!session) return;
    this.setState({ messages: [...this.getState().messages, textMessage("user", text)] });
    try {
      await api.shell(session.id, text);
    } catch (error) {
      this.setState({ messages: [...this.getState().messages, textMessage("system", String(error))], error: String(error) });
    }
  }

  async runCommand(text: string) {
    const session = this.getState().selectedSession;
    if (!session) return;
    this.setState({ messages: [...this.getState().messages, textMessage("user", text)] });
    try {
      this.applyCommandResult(await api.runCommand(session.id, text));
    } catch (error) {
      this.setState({ messages: [...this.getState().messages, textMessage("system", String(error))], error: String(error) });
    }
  }

  async respondToCommand(requestId: string, value: string) {
    const session = this.getState().selectedSession;
    if (!session) return;
    this.setState({ commandDialog: undefined });
    try {
      this.applyCommandResult(await api.respondToCommand(session.id, requestId, value));
    } catch (error) {
      this.setState({ error: String(error) });
    }
  }

  cancelCommand() {
    this.setState({ commandDialog: undefined });
  }

  async stopSession() {
    const session = this.getState().selectedSession;
    if (!session) return;
    try {
      await api.stop(session.id);
    } catch (error) {
      this.setState({ error: String(error) });
    } finally {
      this.clearActiveSession();
      this.updateUrl();
    }
  }

  private applyCommandResult(result: CommandResult) {
    if (result.type === "select") {
      this.setState({ commandDialog: result });
      return;
    }
    const message = result.type === "unsupported" ? result.message : result.message;
    if (message) this.setState({ messages: [...this.getState().messages, textMessage(result.type === "unsupported" ? "system" : "tool", message)] });
    if (result.type === "done" && result.session) {
      const current = this.getState().selectedSession;
      const sessions = [result.session, ...this.getState().sessions.filter((session) => session.id !== result.session?.id)];
      this.setState({ sessions, selectedSession: current?.id === result.session.id ? result.session : current });
      if (current?.id !== result.session.id) void this.selectSession(result.session);
    }
  }

  private applyActivity(activity: SessionActivity) {
    this.setState({
      sessionActivities: { ...this.getState().sessionActivities, [activity.sessionId]: activity },
      activity: this.getState().selectedSession?.id === activity.sessionId ? activity : this.getState().activity,
    });
  }

  private applyStatus(status: SessionStatus) {
    this.setState({
      sessionStatuses: { ...this.getState().sessionStatuses, [status.sessionId]: status },
      status: this.getState().selectedSession?.id === status.sessionId ? status : this.getState().status,
    });
  }

  private applyEvent(event: SessionUiEvent) {
    const messages = this.getState().messages;
    if (event.type === "assistant.delta") {
      this.setState({ messages: appendText(messages, "assistant", event.text) });
    } else if (event.type === "tool.start") {
      this.setState({ messages: appendPart(messages, "assistant", { type: "toolCall", toolName: event.toolName, summary: event.summary }) });
    } else if (event.type === "tool.end") {
      this.setState({ messages: [...messages, { role: "tool", parts: [{ type: "toolResult", toolName: event.toolName, text: event.text, isError: event.isError }] }] });
    } else if (event.type === "shell.start") {
      this.setState({ messages: [...messages, textMessage("bash", `$ ${event.command}${event.excludeFromContext ? "\n\nexcluded from context" : ""}`)] });
    } else if (event.type === "shell.chunk") {
      this.setState({ messages: appendShellChunk(messages, event.chunk) });
    } else if (event.type === "shell.end") {
      this.setState({ messages: finalizeShellMessage(messages, event) });
    } else if (event.type === "status.update") {
      this.applyStatus(event.status);
    } else if (event.type === "activity.update") {
      this.applyActivity(event.activity);
    } else if (event.type === "command.output") {
      this.setState({ messages: [...messages, textMessage(event.level === "error" ? "system" : "tool", event.message)] });
    } else if (event.type === "session.error") {
      this.setState({ messages: [...messages, textMessage("system", event.message)] });
    }
  }
}

function appendPart(messages: ChatLine[], role: ChatLine["role"], part: ChatPart): ChatLine[] {
  const last = messages.at(-1);
  if (last?.role === role) return [...messages.slice(0, -1), { ...last, parts: [...last.parts, part] }];
  return [...messages, { role, parts: [part] }];
}

function appendShellChunk(messages: ChatLine[], chunk: string): ChatLine[] {
  const last = messages.at(-1);
  const lastPart = last?.parts.at(-1);
  if (last?.role !== "bash" || lastPart?.type !== "text") return [...messages, textMessage("bash", chunk)];
  const separator = lastPart.text.includes("\n\n") ? "" : "\n\n";
  return [...messages.slice(0, -1), { ...last, parts: [...last.parts.slice(0, -1), { ...lastPart, text: lastPart.text + separator + chunk }] }];
}

function finalizeShellMessage(messages: ChatLine[], event: Extract<SessionUiEvent, { type: "shell.end" }>): ChatLine[] {
  const last = messages.at(-1);
  const lastPart = last?.parts.at(-1);
  if (last?.role !== "bash" || lastPart?.type !== "text") return messages;
  const notes: string[] = [];
  if (!lastPart.text.includes("\n\n") && !event.output) notes.push("(no output)");
  if (event.isError) notes.push(event.output ?? "Bash command failed");
  if (event.exitCode != null) notes.push(`exit ${event.exitCode}`);
  if (event.cancelled) notes.push("cancelled");
  if (event.truncated) notes.push("output truncated");
  if (event.fullOutputPath) notes.push(`full output: ${event.fullOutputPath}`);
  if (!notes.length) return messages;
  return [...messages.slice(0, -1), { ...last, parts: [...last.parts.slice(0, -1), { ...lastPart, text: `${lastPart.text}\n\n${notes.join("\n")}` }] }];
}
