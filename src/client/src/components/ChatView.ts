import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatLine } from "./shared";
import { chatStyles } from "./shared";

@customElement("chat-view")
export class ChatView extends LitElement {
  @property({ attribute: false }) messages: ChatLine[] = [];

  render() {
    return html`
      <div class="chat">
        ${this.messages.map((message) => html`<div class="msg ${message.role}"><b>${message.role}</b><pre>${message.text}</pre></div>`)}
      </div>
    `;
  }

  static styles = chatStyles;
}
