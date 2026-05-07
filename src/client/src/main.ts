import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api, sessionEvents, type Project, type SessionInfo, type Workspace } from "./api";

interface ChatLine {
  role: "user" | "assistant" | "tool" | "system";
  text: string;
}

@customElement("pi-web-poc")
class PiWebPoc extends LitElement {
  @state() private projects: Project[] = [];
  @state() private workspaces: Workspace[] = [];
  @state() private sessions: SessionInfo[] = [];
  @state() private messages: ChatLine[] = [];
  @state() private selectedProject?: Project;
  @state() private selectedWorkspace?: Workspace;
  @state() private selectedSession?: SessionInfo;
  @state() private error = "";
  @state() private draft = "";
  private socket?: WebSocket;

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadProjects();
  }

  disconnectedCallback(): void {
    this.socket?.close();
    super.disconnectedCallback();
  }

  private async loadProjects() {
    this.error = "";
    try {
      this.projects = await api.projects();
    } catch (error) {
      this.error = String(error);
    }
  }

  private async addProject() {
    const path = prompt("Project folder path");
    if (!path) return;
    try {
      const project = await api.addProject(path);
      this.projects = [...this.projects.filter((p) => p.id !== project.id), project];
      await this.selectProject(project);
    } catch (error) {
      this.error = String(error);
    }
  }

  private async selectProject(project: Project) {
    this.selectedProject = project;
    this.selectedWorkspace = undefined;
    this.selectedSession = undefined;
    this.sessions = [];
    this.messages = [];
    try {
      this.workspaces = await api.workspaces(project.id);
      if (this.workspaces[0]) await this.selectWorkspace(this.workspaces[0]);
    } catch (error) {
      this.error = String(error);
    }
  }

  private async selectWorkspace(workspace: Workspace) {
    this.selectedWorkspace = workspace;
    this.selectedSession = undefined;
    this.messages = [];
    try {
      this.sessions = await api.sessions(workspace.path);
    } catch (error) {
      this.error = String(error);
    }
  }

  private async startSession() {
    if (!this.selectedWorkspace) return;
    try {
      const session = await api.startSession(this.selectedWorkspace.path);
      this.sessions = [session, ...this.sessions];
      await this.selectSession(session);
    } catch (error) {
      this.error = String(error);
    }
  }

  private async selectSession(session: SessionInfo) {
    this.selectedSession = session;
    this.socket?.close();
    this.messages = normalizeMessages(await api.messages(session.id));
    this.socket = sessionEvents(session.id);
    this.socket.onmessage = (message) => this.applyEvent(JSON.parse(message.data));
  }

  private applyEvent(event: any) {
    if (event.type === "assistant.delta") {
      const lines = [...this.messages];
      const last = lines.at(-1);
      if (last?.role === "assistant") last.text += event.text;
      else lines.push({ role: "assistant", text: event.text });
      this.messages = lines;
    } else if (event.type === "tool.start") {
      this.messages = [...this.messages, { role: "tool", text: `▶ ${event.toolName}` }];
    } else if (event.type === "tool.end") {
      this.messages = [...this.messages, { role: "tool", text: `${event.isError ? "✖" : "✓"} ${event.toolName}` }];
    } else if (event.type === "session.error") {
      this.messages = [...this.messages, { role: "system", text: event.message }];
    }
  }

  private async send() {
    const text = this.draft.trim();
    if (!text || !this.selectedSession) return;
    this.draft = "";
    this.messages = [...this.messages, { role: "user", text }];
    try {
      await api.prompt(this.selectedSession.id, text);
    } catch (error) {
      this.error = String(error);
    }
  }

  private async closeSession() {
    if (!this.selectedSession) return;
    await api.close(this.selectedSession.id);
    this.selectedSession = undefined;
    this.socket?.close();
    this.messages = [];
  }

  render() {
    return html`
      <div class="shell">
        <aside>
          <header>
            <strong>Pi Web POC</strong>
            <button @click=${this.addProject}>+ Project</button>
          </header>

          <section>
            <h2>Projects</h2>
            ${this.projects.map((project) => html`
              <button class=${this.selectedProject?.id === project.id ? "selected" : ""} @click=${() => this.selectProject(project)}>
                <span>${project.name}</span><small>${project.path}</small>
              </button>
            `)}
          </section>

          <section>
            <h2>Workspaces</h2>
            ${this.workspaces.map((workspace) => html`
              <button class=${this.selectedWorkspace?.id === workspace.id ? "selected" : ""} @click=${() => this.selectWorkspace(workspace)}>
                <span>${workspace.label}${workspace.isMain ? " · main" : ""}</span><small>${workspace.path}</small>
              </button>
            `)}
          </section>

          <section>
            <h2>Sessions <button ?disabled=${!this.selectedWorkspace} @click=${this.startSession}>+</button></h2>
            ${this.sessions.map((session) => html`
              <button class=${this.selectedSession?.id === session.id ? "selected" : ""} @click=${() => this.selectSession(session)}>
                <span>${session.name || session.firstMessage || session.id.slice(0, 8)}</span><small>${session.messageCount} messages</small>
              </button>
            `)}
          </section>
        </aside>

        <main>
          ${this.error ? html`<div class="error">${this.error}</div>` : null}
          ${this.selectedSession ? html`
            <div class="chat">
              ${this.messages.map((message) => html`<div class="msg ${message.role}"><b>${message.role}</b><pre>${message.text}</pre></div>`)}
            </div>
            <footer>
              <textarea .value=${this.draft} @input=${(e: Event) => (this.draft = (e.target as HTMLTextAreaElement).value)} @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void this.send();
                }
              }} placeholder="Message pi..."></textarea>
              <button @click=${this.send}>Send</button>
              <button @click=${this.closeSession}>Close</button>
            </footer>
          ` : html`<div class="empty">Select or start a session.</div>`}
        </main>
      </div>
    `;
  }

  static styles = css`
    :host { display: block; height: 100vh; color: #e6edf3; background: #0d1117; font: 14px system-ui, sans-serif; }
    .shell { display: grid; grid-template-columns: 340px 1fr; height: 100%; }
    aside { border-right: 1px solid #30363d; overflow: auto; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #30363d; }
    section { padding: 10px; border-bottom: 1px solid #21262d; }
    h2 { display: flex; justify-content: space-between; align-items: center; margin: 0 0 8px; color: #8b949e; font-size: 12px; text-transform: uppercase; }
    button { border: 1px solid #30363d; border-radius: 8px; background: #161b22; color: #e6edf3; padding: 7px 9px; cursor: pointer; }
    section > button { display: block; width: 100%; text-align: left; margin: 6px 0; }
    button.selected { border-color: #58a6ff; background: #0d2847; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    small { display: block; color: #8b949e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    main { display: flex; flex-direction: column; min-width: 0; }
    .chat { flex: 1; overflow: auto; padding: 16px; }
    .msg { margin: 0 0 14px; padding: 12px; border: 1px solid #30363d; border-radius: 10px; background: #161b22; }
    .msg.user { border-color: #2f81f7; }
    .msg.tool { color: #d29922; }
    .msg.system, .error { color: #ff7b72; }
    pre { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    footer { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; padding: 12px; border-top: 1px solid #30363d; }
    textarea { min-height: 54px; resize: vertical; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; padding: 8px; }
    .empty { margin: auto; color: #8b949e; }
    .error { padding: 10px 16px; border-bottom: 1px solid #30363d; }
  `;
}

function normalizeMessages(messages: any[]): ChatLine[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "system",
    text: typeof message.content === "string" ? message.content : JSON.stringify(message.content, null, 2),
  }));
}
