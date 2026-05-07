# Pi Web POC

Small web wrapper around `@mariozechner/pi-coding-agent`.

## What it does

- Add/list projects.
- Discover workspaces from `git worktree list --porcelain`.
- For non-git projects, show the project folder as the only workspace.
- List Pi sessions for a workspace using Pi's default session storage.
- Start Pi sessions, chat over WebSocket events, and close active runtimes.

## State

This POC intentionally keeps state minimal:

- Projects: `~/.pi-web/projects.json`
- Workspaces: discovered from git, not stored
- Sessions/chat history: Pi default JSONL session storage
- Active sessions/WebSockets: memory only

## Run

```bash
npm install
npm run dev
```

Open the Vite URL, usually <http://localhost:5173>.

For a single-process/proxied deployment:

```bash
npm run build
PI_WEB_PORT=3000 npm start
```

Then proxy Traefik to `http://127.0.0.1:3000`.

The server defaults to `127.0.0.1:3000`. Use `PI_WEB_HOST=0.0.0.0` only if you want to bind directly on all interfaces.

## Notes

- The backend uses your normal Pi auth/model settings from `~/.pi/agent`.
- Slash commands that belong to Pi's interactive TUI, such as `/model`, are not implemented in this POC UI yet. Plain prompts and extension/prompt-template handling go through the SDK path.
- `Close` currently only disposes the in-memory runtime. It does not hide or delete sessions.
