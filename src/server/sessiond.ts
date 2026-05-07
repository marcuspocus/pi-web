import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { SessionEventHub } from "./realtime/sessionEventHub.js";
import { PiSessionService } from "./sessions/piSessionService.js";
import { registerSessionRoutes } from "./sessions/sessionRoutes.js";
import { sessiondSocketPath } from "./sessiond/config.js";

const app = Fastify({ logger: true });
await app.register(fastifyWebsocket);

const eventHub = new SessionEventHub();
const sessions = new PiSessionService(eventHub);
await registerSessionRoutes(app, sessions, eventHub);

const port = process.env.PI_WEB_SESSIOND_PORT ? Number(process.env.PI_WEB_SESSIOND_PORT) : undefined;
const host = process.env.PI_WEB_SESSIOND_HOST ?? "127.0.0.1";

if (port) {
  await app.listen({ port, host });
} else {
  const path = sessiondSocketPath();
  await mkdir(dirname(path), { recursive: true });
  await rm(path, { force: true });
  await app.listen({ path });
  process.on("exit", () => void rm(path, { force: true }));
}
