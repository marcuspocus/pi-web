import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from "@mariozechner/pi-coding-agent";
import type { ClientCommand, ClientSession, ClientSessionStatus } from "../types.js";
import type { SessionEventHub } from "../realtime/sessionEventHub.js";

interface ActiveSession {
  session: AgentSession;
  unsubscribe: () => void;
}

const BUILTIN_COMMANDS: ClientCommand[] = [
  { name: "settings", description: "Open settings menu", source: "builtin" },
  { name: "model", description: "Select model", source: "builtin" },
  { name: "scoped-models", description: "Enable/disable models for cycling", source: "builtin" },
  { name: "export", description: "Export session", source: "builtin" },
  { name: "import", description: "Import and resume a session from JSONL", source: "builtin" },
  { name: "share", description: "Share session as a secret GitHub gist", source: "builtin" },
  { name: "copy", description: "Copy last agent message", source: "builtin" },
  { name: "name", description: "Set session display name", source: "builtin" },
  { name: "session", description: "Show session info and stats", source: "builtin" },
  { name: "changelog", description: "Show changelog entries", source: "builtin" },
  { name: "hotkeys", description: "Show keyboard shortcuts", source: "builtin" },
  { name: "fork", description: "Create a new fork from a previous user message", source: "builtin" },
  { name: "clone", description: "Duplicate current session at current position", source: "builtin" },
  { name: "tree", description: "Navigate session tree", source: "builtin" },
  { name: "login", description: "Configure provider authentication", source: "builtin" },
  { name: "logout", description: "Remove provider authentication", source: "builtin" },
  { name: "new", description: "Start a new session", source: "builtin" },
  { name: "compact", description: "Manually compact session context", source: "builtin" },
  { name: "resume", description: "Resume a different session", source: "builtin" },
  { name: "reload", description: "Reload keybindings, extensions, skills, prompts, and themes", source: "builtin" },
  { name: "quit", description: "Quit pi", source: "builtin" },
];

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

  async status(sessionId: string): Promise<ClientSessionStatus> {
    return this.statusFromSession(await this.getOrOpen(sessionId));
  }

  async commands(sessionId: string): Promise<ClientCommand[]> {
    const session = await this.getOrOpen(sessionId);
    const commands: ClientCommand[] = [...BUILTIN_COMMANDS];
    for (const command of session.extensionRunner.getRegisteredCommands()) {
      commands.push({ name: command.invocationName, description: command.description, source: "extension" });
    }
    for (const template of session.promptTemplates) {
      commands.push({ name: template.name, description: template.description, source: "prompt" });
    }
    for (const skill of session.resourceLoader.getSkills().skills) {
      commands.push({ name: `skill:${skill.name}`, description: skill.description, source: "skill" });
    }
    return commands.sort((a, b) => a.name.localeCompare(b.name));
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
      this.events.publish(session.sessionId, { type: "status.update", status: this.statusFromSession(session) });
    });

    const active = { session, unsubscribe };
    this.active.set(session.sessionId, active);
    this.events.publish(session.sessionId, { type: "status.update", status: this.statusFromSession(session) });
    return active;
  }

  private statusFromSession(session: AgentSession): ClientSessionStatus {
    const stats = session.getSessionStats();
    return {
      sessionId: session.sessionId,
      model: session.model
        ? {
            provider: session.model.provider,
            id: session.model.id,
            name: (session.model as any).name,
            contextWindow: session.model.contextWindow,
            reasoning: (session.model as any).reasoning,
          }
        : undefined,
      thinkingLevel: session.thinkingLevel,
      isStreaming: session.isStreaming,
      isCompacting: session.isCompacting,
      isBashRunning: session.isBashRunning,
      pendingMessageCount: session.pendingMessageCount,
      tokens: stats.tokens,
      cost: stats.cost,
      contextUsage: session.getContextUsage(),
    };
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
