import { homedir } from "node:os";
import { join } from "node:path";

export function sessiondSocketPath(): string {
  return process.env.PI_WEB_SESSIOND_SOCKET ?? join(homedir(), ".pi-web", "sessiond.sock");
}

export function sessiondHttpUrl(): string | undefined {
  return process.env.PI_WEB_SESSIOND_URL;
}
