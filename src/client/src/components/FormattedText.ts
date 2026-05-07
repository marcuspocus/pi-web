import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { toSafeMarkdownHtml } from "../formatting/markdown";
import { formattedTextStyles } from "./shared";

@customElement("formatted-text")
export class FormattedText extends LitElement {
  @property() text = "";

  render() {
    return html`<div class="formatted">${unsafeHTML(toSafeMarkdownHtml(this.text))}</div>`;
  }

  static styles = formattedTextStyles;
}
