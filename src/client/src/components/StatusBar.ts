import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SessionStatus, Workspace } from "../api";
import { formatCost, formatTokenCount } from "../utils/format";
import { statusBarStyles } from "./shared";

@customElement("status-bar")
export class StatusBar extends LitElement {
  @property({ attribute: false }) status?: SessionStatus;
  @property({ attribute: false }) workspace?: Workspace;

  render() {
    const status = this.status;
    if (!status) return html`<div class="bar muted">No session status yet</div>`;
    const model = status.model?.id ?? "no model";
    const provider = status.model?.provider ? `${status.model.provider}/` : "";
    const state = status.isCompacting ? "compacting" : status.isBashRunning ? "bash" : status.isStreaming ? "running" : "idle";
    const context = status.contextUsage;
    const contextText = context
      ? `${context.percent == null ? "?" : context.percent.toFixed(1)}%/${formatTokenCount(context.contextWindow)}`
      : "context ?";
    const tokens = status.tokens;
    return html`
      <div class="bar">
        <span title=${this.workspace?.path ?? ""}>${this.workspace?.label ?? "workspace"}</span>
        <span>${state}</span>
        <span>${provider}${model}</span>
        <span>thinking ${status.thinkingLevel ?? "off"}</span>
        <span>↑${formatTokenCount(tokens.input)}</span>
        <span>↓${formatTokenCount(tokens.output)}</span>
        <span>${contextText}</span>
        <span>${formatCost(status.cost)}</span>
        ${status.pendingMessageCount ? html`<span>${status.pendingMessageCount} queued</span>` : null}
      </div>
    `;
  }

  static styles = statusBarStyles;
}
