import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Workspace } from "../api";
import type { WorkspaceLabelItem } from "../plugins/types";
import { listStyles } from "./shared";
import { renderWorkspaceLabelItems } from "./workspaceLabel";

@customElement("workspace-list")
export class WorkspaceList extends LitElement {
  @property({ attribute: false }) workspaces: Workspace[] = [];
  @property({ attribute: false }) selected?: Workspace;
  @property({ attribute: false }) workspaceLabelItems: (workspace: Workspace) => WorkspaceLabelItem[] = () => [];
  @property({ attribute: false }) onSelect?: (workspace: Workspace) => void;

  override render() {
    return html`
      <section>
        <h2>Workspaces</h2>
        ${this.workspaces.map((workspace) => {
          const label = `${workspace.label}${workspace.isMain ? " · main" : ""}`;
          return html`
            <div class=${this.selected?.id === workspace.id ? "workspace-row selected" : "workspace-row"}>
              <div class="workspace-main">
                <span class="workspace-label">
                  <button class="workspace-select" title=${workspace.path} @click=${() => this.onSelect?.(workspace)}>${label}</button>
                  ${renderWorkspaceLabelItems(this.workspaceLabelItems(workspace))}
                </span>
                <small>${workspace.path}</small>
              </div>
            </div>
          `;
        })}
      </section>
    `;
  }

  static override styles = listStyles;
}
