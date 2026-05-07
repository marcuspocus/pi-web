import type { WebSocket } from "ws";

export class SessionEventHub {
  private readonly socketsBySession = new Map<string, Set<WebSocket>>();

  add(sessionId: string, socket: WebSocket): void {
    let sockets = this.socketsBySession.get(sessionId);
    if (!sockets) {
      sockets = new Set();
      this.socketsBySession.set(sessionId, sockets);
    }
    sockets.add(socket);
    socket.on("close", () => sockets?.delete(socket));
  }

  publish(sessionId: string, event: unknown): void {
    const payload = JSON.stringify(event);
    for (const socket of this.socketsBySession.get(sessionId) ?? []) {
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  }
}
