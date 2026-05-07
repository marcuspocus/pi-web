import { sessionEvents } from "./api";

export type SessionUiEvent =
  | { type: "assistant.delta"; text: string }
  | { type: "tool.start"; toolName: string }
  | { type: "tool.end"; toolName: string; isError: boolean }
  | { type: "session.error"; message: string };

export class SessionSocket {
  private socket?: WebSocket;

  connect(sessionId: string, onEvent: (event: SessionUiEvent) => void): void {
    this.close();
    this.socket = sessionEvents(sessionId);
    this.socket.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (isSessionUiEvent(event)) onEvent(event);
    };
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}

function isSessionUiEvent(event: any): event is SessionUiEvent {
  return ["assistant.delta", "tool.start", "tool.end", "session.error"].includes(event?.type);
}
