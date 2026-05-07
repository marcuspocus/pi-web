import type { FastifyInstance } from "fastify";
import type { SessionEventHub } from "../realtime/sessionEventHub.js";
import type { PiSessionService } from "./piSessionService.js";

export async function registerSessionRoutes(app: FastifyInstance, sessions: PiSessionService, eventHub: SessionEventHub, prefix = ""): Promise<void> {
  app.get<{ Querystring: { cwd?: string } }>(`${prefix}/sessions`, async (request, reply) => {
    if (!request.query.cwd) return reply.code(400).send({ error: "cwd query parameter is required" });
    return sessions.list(request.query.cwd);
  });

  app.post<{ Body: { cwd: string } }>(`${prefix}/sessions`, async (request, reply) => {
    try {
      return await sessions.start(request.body.cwd);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Params: { sessionId: string } }>(`${prefix}/sessions/:sessionId/messages`, async (request, reply) => {
    try {
      return await sessions.messages(request.params.sessionId);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Params: { sessionId: string } }>(`${prefix}/sessions/:sessionId/status`, async (request, reply) => {
    try {
      return await sessions.status(request.params.sessionId);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Params: { sessionId: string } }>(`${prefix}/sessions/:sessionId/commands`, async (request, reply) => {
    try {
      return await sessions.commands(request.params.sessionId);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { sessionId: string }; Body: { text: string } }>(`${prefix}/sessions/:sessionId/prompt`, async (request, reply) => {
    try {
      await sessions.prompt(request.params.sessionId, request.body.text);
      return { accepted: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { sessionId: string }; Body: { text: string } }>(`${prefix}/sessions/:sessionId/shell`, async (request, reply) => {
    try {
      await sessions.shell(request.params.sessionId, request.body.text);
      return { accepted: true };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { sessionId: string }; Body: { text: string } }>(`${prefix}/sessions/:sessionId/commands/run`, async (request, reply) => {
    try {
      return await sessions.runCommand(request.params.sessionId, request.body.text);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { sessionId: string }; Body: { requestId: string; value: string } }>(`${prefix}/sessions/:sessionId/commands/respond`, async (request, reply) => {
    try {
      return await sessions.respondToCommand(request.params.sessionId, request.body.requestId, request.body.value);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { sessionId: string } }>(`${prefix}/sessions/:sessionId/abort`, async (request) => {
    await sessions.abort(request.params.sessionId);
    return { aborted: true };
  });

  app.post<{ Params: { sessionId: string } }>(`${prefix}/sessions/:sessionId/stop`, async (request) => {
    sessions.stop(request.params.sessionId);
    return { stopped: true };
  });

  app.get<{ Params: { sessionId: string } }>(`${prefix}/sessions/:sessionId/events`, { websocket: true }, (socket, request) => {
    eventHub.add(request.params.sessionId, socket);
  });

  app.get(`${prefix}/sessions/events`, { websocket: true }, (socket) => {
    eventHub.addGlobal(socket);
  });
}
