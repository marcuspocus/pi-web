import { globalSessionEvents, sessionEvents, type SessionStatus } from "./api";

export type SessionUiEvent =
  | { type: "assistant.delta"; text: string }
  | { type: "tool.start"; toolName: string }
  | { type: "tool.end"; toolName: string; isError: boolean }
  | { type: "status.update"; status: SessionStatus }
  | { type: "session.error"; message: string };

export class SessionSocket {
  private socket?: WebSocket;
  private onEvent?: (event: SessionUiEvent) => void;

  connect(sessionId: string, onEvent: (event: SessionUiEvent) => void): void {
    this.close();
    this.onEvent = onEvent;
    this.socket = sessionEvents(sessionId);
    this.socket.onmessage = (message) => this.handleMessage(message.data);
  }

  setHandler(onEvent: (event: SessionUiEvent) => void): void {
    this.onEvent = onEvent;
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
    this.onEvent = undefined;
  }

  private handleMessage(data: string): void {
    const event = JSON.parse(data);
    if (isSessionUiEvent(event)) this.onEvent?.(event);
  }
}

export class GlobalSessionSocket {
  private socket?: WebSocket;

  connect(onEvent: (event: Extract<SessionUiEvent, { type: "status.update" }>) => void): void {
    this.close();
    this.socket = globalSessionEvents();
    this.socket.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event?.type === "status.update") onEvent(event);
    };
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}

function isSessionUiEvent(event: any): event is SessionUiEvent {
  return ["assistant.delta", "tool.start", "tool.end", "status.update", "session.error"].includes(event?.type);
}

