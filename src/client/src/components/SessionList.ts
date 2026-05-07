import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SessionInfo } from "../api";
import { listStyles } from "./shared";

@customElement("session-list")
export class SessionList extends LitElement {
  @property({ attribute: false }) sessions: SessionInfo[] = [];
  @property({ attribute: false }) selected?: SessionInfo;
  @property({ type: Boolean }) canStart = false;
  @property({ attribute: false }) onSelect?: (session: SessionInfo) => void;
  @property({ attribute: false }) onStart?: () => void;

  render() {
    return html`
      <section>
        <h2>Sessions <button ?disabled=${!this.canStart} @click=${() => this.onStart?.()}>+</button></h2>
        ${this.sessions.map((session) => html`
          <button class=${this.selected?.id === session.id ? "selected" : ""} @click=${() => this.onSelect?.(session)}>
            <span>${session.name || session.firstMessage || session.id.slice(0, 8)}</span><small>${session.messageCount} messages</small>
          </button>
        `)}
      </section>
    `;
  }

  static styles = listStyles;
}
