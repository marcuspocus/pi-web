import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";
import type { ClientSession } from "../types.js";
import type { SessionEventHub } from "../realtime/sessionEventHub.js";

interface ActiveSession {
  session: AgentSession;
  unsubscribe: () => void;
}

export class PiSessionService {
  private readonly active = new Map<string, ActiveSession>();
  private readonly authStorage = AuthStorage.create();
  private readonly modelRegistry = ModelRegistry.create(this.authStorage);

  constructor(private readonly events: SessionEventHub) {}

  async list(cwd: string): Promise<ClientSession[]> {
    const sessions = await SessionManager.list(cwd);
    return sessions.map((s) => ({
      id: s.id,
      path: s.path,
      cwd: s.cwd,
      name: s.name,
      created: s.created.toISOString(),
      modified: s.modified.toISOString(),
      messageCount: s.messageCount,
      firstMessage: s.firstMessage,
    }));
  }

  async start(cwd: string): Promise<ClientSession> {
    const { session } = await this.create(SessionManager.create(cwd), cwd);
    return {
      id: session.sessionId,
      path: session.sessionFile ?? "",
      cwd,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      messageCount: session.messages.length,
      firstMessage: "",
    };
  }

  async messages(sessionId: string): Promise<unknown[]> {
    const session = await this.getOrOpen(sessionId);
    return session.messages;
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    const session = await this.getOrOpen(sessionId);
    void session.prompt(text).catch((error) => {
      this.events.publish(sessionId, { type: "session.error", message: error instanceof Error ? error.message : String(error) });
    });
  }

  async abort(sessionId: string): Promise<void> {
    const active = this.active.get(sessionId);
    if (active) await active.session.abort();
  }

  close(sessionId: string): void {
    const active = this.active.get(sessionId);
    if (!active) return;
    active.unsubscribe();
    active.session.dispose();
    this.active.delete(sessionId);
  }

  private async getOrOpen(sessionId: string): Promise<AgentSession> {
    const active = this.active.get(sessionId);
    if (active) return active.session;

    const match = (await SessionManager.listAll()).find((s) => s.id === sessionId || s.id.startsWith(sessionId));
    if (!match) throw new Error("Session not found");
    return (await this.create(SessionManager.open(match.path), match.cwd)).session;
  }

  private async create(sessionManager: SessionManager, cwd: string): Promise<ActiveSession> {
    const { session } = await createAgentSession({
      cwd,
      sessionManager,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
    });

    const unsubscribe = session.subscribe((event) => {
      this.events.publish(session.sessionId, toClientEvent(event));
    });

    const active = { session, unsubscribe };
    this.active.set(session.sessionId, active);
    return active;
  }
}

function toClientEvent(event: any): unknown {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    return { type: "assistant.delta", text: event.assistantMessageEvent.delta };
  }
  if (event.type === "tool_execution_start") {
    return { type: "tool.start", toolName: event.toolName, toolCallId: event.toolCallId };
  }
  if (event.type === "tool_execution_end") {
    return { type: "tool.end", toolName: event.toolName, toolCallId: event.toolCallId, isError: event.isError };
  }
  if (event.type === "agent_start") return { type: "agent.start" };
  if (event.type === "agent_end") return { type: "agent.end" };
  if (event.type === "message_end") return { type: "message.end" };
  return { type: "pi.event", eventType: event.type };
}
