# Pi Web POC

Small web wrapper around `@mariozechner/pi-coding-agent`.

## What it does

- Add/list projects.
- Discover workspaces from `git worktree list --porcelain`.
- For non-git projects, show the project folder as the only workspace.
- List Pi sessions for a workspace using Pi's default session storage.
- Start Pi sessions, chat over WebSocket events, and stop individual session runtimes.

## State

This POC intentionally keeps state minimal:

- Projects: `~/.pi-web/projects.json`
- Workspaces: discovered from git, not stored
- Sessions/chat history: Pi default JSONL session storage
- Active session runtimes/WebSockets: memory only in `pi-web-sessiond`

## Run

```bash
npm install
npm run dev
```

Open the Vite URL, usually <http://localhost:5173>.

The session runtime owner is split into a tiny long-lived daemon. To iterate on only the web/API/UI process while keeping active Pi sessions alive, run these in separate terminals:

```bash
npm run dev:sessiond
npm run dev:web
npm run dev:client
```

Then restart `dev:web` or `dev:client` freely; active Pi sessions continue in `dev:sessiond`.

For deployment:

```bash
npm run build
npm run start:sessiond
PI_WEB_PORT=3000 npm start
```

Then proxy Traefik to `http://127.0.0.1:3000`.

The web server defaults to `127.0.0.1:3000`. Use `PI_WEB_HOST=0.0.0.0` only if you want to bind directly on all interfaces. The session daemon defaults to a private Unix socket at `~/.pi-web/sessiond.sock`; override with `PI_WEB_SESSIOND_SOCKET` or use TCP with `PI_WEB_SESSIOND_PORT` plus `PI_WEB_SESSIOND_URL` for the web process.

## Notes

- The backend uses your normal Pi auth/model settings from `~/.pi/agent`.
- Slash commands that belong to Pi's interactive TUI, such as `/model`, are not implemented in this POC UI yet. Plain prompts and extension/prompt-template handling go through the SDK path.
- Browser disconnects and web-server restarts do not stop active Pi sessions. Only the explicit `Stop session` action aborts/disposes that one session runtime.
