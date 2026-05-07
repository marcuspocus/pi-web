import { css } from "lit";

export interface ChatLine {
  role: "user" | "assistant" | "tool" | "system";
  text: string;
}

export const appStyles = css`
  :host { display: block; height: 100vh; color: #e6edf3; background: #0d1117; font: 14px system-ui, sans-serif; }
  .shell { display: grid; grid-template-columns: 340px 1fr; height: 100%; min-height: 0; }
  aside { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid #30363d; overflow: hidden; }
  header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #30363d; }
  project-list, workspace-list { flex: 0 0 auto; max-height: 26%; overflow: auto; border-bottom: 1px solid #21262d; }
  session-list { flex: 1 1 auto; min-height: 0; overflow: auto; }
  main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  chat-view { flex: 1 1 auto; min-height: 0; overflow: auto; }
  chat-composer { flex: 0 0 auto; }
  button { border: 1px solid #30363d; border-radius: 8px; background: #161b22; color: #e6edf3; padding: 7px 9px; cursor: pointer; }
  .empty { margin: auto; color: #8b949e; }
  .error { padding: 10px 16px; border-bottom: 1px solid #30363d; color: #ff7b72; }
`;

export const listStyles = css`
  :host { display: block; color: #e6edf3; font: 14px system-ui, sans-serif; }
  section { padding: 10px; }
  h2 { display: flex; justify-content: space-between; align-items: center; margin: 0 0 8px; color: #8b949e; font-size: 12px; text-transform: uppercase; }
  button { border: 1px solid #30363d; border-radius: 8px; background: #161b22; color: #e6edf3; padding: 7px 9px; cursor: pointer; }
  section > button { display: block; width: 100%; text-align: left; margin: 6px 0; }
  button.selected { border-color: #58a6ff; background: #0d2847; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  small { display: block; color: #8b949e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

export const chatStyles = css`
  :host { display: block; min-height: 0; color: #e6edf3; font: 14px system-ui, sans-serif; }
  .chat { height: 100%; overflow: auto; padding: 16px; box-sizing: border-box; }
  .msg { margin: 0 0 14px; padding: 12px; border: 1px solid #30363d; border-radius: 10px; background: #161b22; }
  .msg.user { border-color: #2f81f7; }
  .msg.tool { color: #d29922; }
  .msg.system { color: #ff7b72; }
  pre { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
`;

export const composerStyles = css`
  :host { display: block; color: #e6edf3; font: 14px system-ui, sans-serif; }
  footer { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; padding: 12px; border-top: 1px solid #30363d; }
  textarea { min-height: 54px; resize: vertical; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; padding: 8px; }
  button { border: 1px solid #30363d; border-radius: 8px; background: #161b22; color: #e6edf3; padding: 7px 9px; cursor: pointer; }
  button:disabled, textarea:disabled { opacity: .5; cursor: not-allowed; }
`;
