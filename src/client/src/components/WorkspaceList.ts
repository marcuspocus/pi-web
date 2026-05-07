import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Workspace } from "../api";
import { listStyles } from "./shared";

@customElement("workspace-list")
export class WorkspaceList extends LitElement {
  @property({ attribute: false }) workspaces: Workspace[] = [];
  @property({ attribute: false }) selected?: Workspace;
  @property({ attribute: false }) onSelect?: (workspace: Workspace) => void;

  render() {
    return html`
      <section>
        <h2>Workspaces</h2>
        ${this.workspaces.map((workspace) => html`
          <button class=${this.selected?.id === workspace.id ? "selected" : ""} @click=${() => this.onSelect?.(workspace)}>
            <span>${workspace.label}${workspace.isMain ? " · main" : ""}</span><small>${workspace.path}</small>
          </button>
        `)}
      </section>
    `;
  }

  static styles = listStyles;
}
