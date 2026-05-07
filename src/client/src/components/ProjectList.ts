import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Project } from "../api";
import { listStyles } from "./shared";

@customElement("project-list")
export class ProjectList extends LitElement {
  @property({ attribute: false }) projects: Project[] = [];
  @property({ attribute: false }) selected?: Project;
  @property({ attribute: false }) onSelect?: (project: Project) => void;

  render() {
    return html`
      <section>
        <h2>Projects</h2>
        ${this.projects.map((project) => html`
          <button class=${this.selected?.id === project.id ? "selected" : ""} @click=${() => this.onSelect?.(project)}>
            <span>${project.name}</span><small>${project.path}</small>
          </button>
        `)}
      </section>
    `;
  }

  static styles = listStyles;
}
