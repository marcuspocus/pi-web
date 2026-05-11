# Pi Web plugin API

Pi Web plugins are trusted browser-side ES modules that extend the Pi Web UI. They are intended to be simple enough that an LLM can create or modify them directly.

Plugins can currently:

- add actions to the action palette;
- add workspace tools/panels next to Files, Git, and Terminal;
- add compact items to workspace labels in the workspace list, panel header, and status bar;
- call browser APIs and Pi Web HTTP/WebSocket APIs available to the current browser session;
- serve their own static assets from the plugin directory.

They do **not** run in the session daemon, do not get a server-side hook API, and are not sandboxed.

## Trust model

Plugins run as JavaScript in the browser app. Treat them as trusted code:

- they can call browser APIs;
- they can `fetch()` Pi Web API endpoints using the current browser access;
- they can read workspace files through Pi Web's file endpoints if the UI can read them;
- they can render arbitrary Lit templates/custom elements in plugin contribution areas;
- they should not be installed from untrusted sources.

This is for personal, team, and project-local customization, not a sandboxed third-party marketplace.

## Quick start: local plugin

Create a folder with a `package.json` and a browser module:

```bash
mkdir -p /srv/dev/my-pi-web-plugin
cat > /srv/dev/my-pi-web-plugin/package.json <<'JSON'
{
  "private": true,
  "piWeb": {
    "id": "my-plugin",
    "plugin": "pi-web-plugin.js"
  }
}
JSON
cat > /srv/dev/my-pi-web-plugin/pi-web-plugin.js <<'JS'
const { html } = globalThis.piWebPluginApi;

export default {
  id: "my-plugin",
  name: "My Plugin",
  activate: () => ({
    actions: [
      {
        id: "workspace.show-path",
        title: "Show Current Workspace Path",
        group: "My Plugin",
        enabled: (context) => context.state.selectedWorkspace !== undefined,
        run: (context) => {
          window.alert(context.state.selectedWorkspace?.path ?? "No workspace selected");
        },
      },
    ],
    workspacePanels: [
      {
        id: "workspace.info",
        title: "Info",
        order: 100,
        render: ({ workspace }) => html`
          <section class="toolbar"><strong>Info</strong></section>
          <section class="viewer">
            <p class="muted">${workspace.label}</p>
            <p class="muted">${workspace.path}</p>
          </section>
        `,
      },
    ],
    workspaceLabelContributions: [
      {
        id: "workspace.kind",
        order: 10,
        items: ({ workspace }) => ({
          type: "text",
          text: workspace.isGitRepo ? "git" : "folder",
          title: workspace.path,
        }),
      },
    ],
  }),
};
JS
```

Symlink it into Pi Web's local plugin directory:

```bash
mkdir -p ~/.pi-web/plugins
ln -s /srv/dev/my-pi-web-plugin ~/.pi-web/plugins/my-plugin
```

Reload the Pi Web browser tab. Pi Web serves plugin modules with an mtime-based `?v=` cache buster. After editing a plugin, hard reload the browser if you do not see changes.

## Discovery and packaging

Pi Web builds `/pi-web-plugins/manifest.json` from these sources:

1. Bundled plugins in the Pi Web package:

   ```text
   pi-web-plugins/<plugin-id>/
   ```

2. User-local plugins:

   ```text
   ~/.pi-web/plugins/<plugin-id>/
   ```

   Entries may be real directories or symlinks. This is the recommended development workflow.

3. Installed Pi packages that expose Pi Web plugin metadata. Pi packages may be user or project scoped.

Plugin directory names and plugin ids should match:

```text
^[a-z][a-z0-9.-]*$
```

### `package.json` metadata

A plugin directory is normally configured with top-level `piWeb` metadata:

```json
{
  "private": true,
  "piWeb": {
    "id": "my-plugin",
    "plugin": "pi-web-plugin.js"
  }
}
```

For multiple plugin entries in one package, use `piWeb.plugins`:

```json
{
  "private": true,
  "piWeb": {
    "id": "my-package",
    "plugins": [
      { "id": "review", "module": "dist/review.js" },
      { "id": "dashboard", "module": "dist/dashboard.js" }
    ]
  }
}
```

`piWeb.plugins` may also be an array of module paths:

```json
{
  "piWeb": {
    "id": "my-package",
    "plugins": ["dist/review.js", "dist/dashboard.js"]
  }
}
```

Pi packages may nest the same metadata under `pi.piWeb`:

```json
{
  "pi": {
    "piWeb": {
      "id": "my-plugin",
      "plugin": "pi-web-plugin.js"
    }
  }
}
```

If a local plugin directory has no `package.json`, Pi Web falls back to `pi-web-plugin.js` in that directory.

Entry module paths must be safe relative paths inside the plugin root. Pi Web ignores empty, absolute, or `..` paths.

### Manifest and assets

The manifest contains each discovered plugin module:

```json
{
  "plugins": [
    {
      "id": "my-plugin",
      "module": "/pi-web-plugins/my-plugin/pi-web-plugin.js?v=1234567890",
      "source": "local",
      "scope": "local"
    }
  ]
}
```

`source` describes where the plugin came from (`bundled`, `local`, or the Pi package source). `scope` is `bundled`, `local`, `user`, or `project`.

A plugin can fetch its own static assets with URLs under:

```text
/pi-web-plugins/<plugin-id>/<path-inside-plugin-root>
```

Pi Web prevents asset path traversal outside the plugin root. JavaScript, JSON, CSS, and HTML get appropriate content types; other files are served as octet-stream.

If two discovered plugins use the same id, the first keeps the id and later ones are renamed to `<id>.2`, `<id>.3`, and so on. Avoid relying on this; prefer unique ids.

## Plugin module shape

The entry module must default-export a `PiWebPlugin` object:

```ts
interface PiWebPlugin {
  id: string;
  name: string;
  activate: (context: PluginActivationContext) => PluginContributions;
}

interface PluginActivationContext {
  apiVersion: 1;
}
```

Example:

```js
export default {
  id: "my-plugin",
  name: "My Plugin",
  activate: ({ apiVersion }) => ({
    actions: [],
    workspacePanels: [],
    workspaceLabelContributions: [],
  }),
};
```

`activate()` is called once when the UI loads the plugin. Keep it cheap: define contributions there, but move expensive or async work into actions, custom elements, or explicit user interactions.

Plugin ids and contribution ids must match:

```text
^[a-z][a-z0-9.-]*$
```

Contribution ids are local to the plugin. Pi Web qualifies them internally as:

```text
<plugin-id>:<local-contribution-id>
```

For example, plugin `info` with action `workspace.show-path` becomes `info:workspace.show-path`.

## Browser global API

External plugins can access this global before they export their plugin:

```js
const { apiVersion, html } = globalThis.piWebPluginApi;
```

- `apiVersion`: currently `1`.
- `html`: Lit's `html` template tag. Use this instead of importing `lit` from an external plugin unless you bundle your own dependencies.

Pi Web does not currently expose typed helper clients to plugins. Use `fetch()` for Pi Web HTTP APIs and browser `WebSocket` for websocket endpoints if needed.

## Contributions

`activate()` returns any combination of these contribution arrays:

```ts
interface PluginContributions {
  actions?: PluginAction[];
  workspacePanels?: WorkspacePanelContribution[];
  workspaceLabelContributions?: WorkspaceLabelContribution[];
}
```

### Actions

Actions appear in the action palette. They can inspect app state and call UI/runtime helpers.

```js
actions: [
  {
    id: "workspace.show-path",
    title: "Show Current Workspace Path",
    description: "Display the selected workspace path",
    shortcut: "mod+shift+p",
    group: "Info",
    enabled: (context) => context.state.selectedWorkspace !== undefined,
    run: (context) => {
      window.alert(context.state.selectedWorkspace?.path ?? "No workspace selected");
    },
  },
]
```

Action type:

```ts
interface PluginAction {
  id: string;
  title: string;
  description?: string;
  shortcut?: string;
  group?: string;
  enabled?: boolean | ((context: PluginRuntimeContext) => boolean);
  run: (context: PluginRuntimeContext) => void | Promise<void>;
}
```

Runtime context:

```ts
interface PluginRuntimeContext {
  state: AppState;
  openActionPalette: () => void;
  focusPrompt: () => void;
  addProject: () => void | Promise<void>;
  selectMainView: (view: "navigation" | "chat" | QualifiedContributionId) => void;
  selectWorkspaceTool: (tool: QualifiedContributionId) => void;
  refreshFiles: () => void | Promise<void>;
  refreshGit: () => void | Promise<void>;
  startSession: () => void | Promise<void>;
  archiveSession: () => void | Promise<void>;
  stopActiveWork: () => void | Promise<void>;
}
```

Notes:

- `state` is a snapshot of current UI state when actions are built.
- `enabled` is evaluated when the action palette asks for actions.
- `selectWorkspaceTool()` expects a qualified panel id such as `my-plugin:workspace.info`.
- `shortcut` is displayed/handled the same way app actions are; choose shortcuts carefully to avoid conflicts.

### Workspace panels

Workspace panels add tools next to built-in workspace tools. They render inside the workspace side panel on desktop and as mobile tabs on smaller screens.

```js
const { html } = globalThis.piWebPluginApi;

workspacePanels: [
  {
    id: "workspace.info",
    title: "Info",
    order: 100,
    visible: (workspace) => workspace.isGitRepo,
    badge: ({ gitStatus }) => gitStatus?.files.length,
    render: ({ workspace, gitStatus, onRefreshGit }) => html`
      <section class="toolbar">
        <strong>Info</strong>
        <button @click=${onRefreshGit}>Refresh git</button>
      </section>
      <section class="viewer">
        <p class="muted">${workspace.label}</p>
        <p class="muted">${workspace.path}</p>
        <p class="muted">Changed files: ${gitStatus?.files.length ?? 0}</p>
      </section>
    `,
  },
]
```

Panel type:

```ts
interface WorkspacePanelContribution {
  id: string;
  title: string;
  order?: number;
  visible?: (workspace: Workspace) => boolean;
  badge?: (context: WorkspacePanelContext) => string | number | TemplateResult | undefined;
  render: (context: WorkspacePanelContext) => TemplateResult;
}
```

Panel context:

```ts
interface WorkspacePanelContext {
  workspace: Workspace;
  fileTree: FileTreeEntry[];
  expandedDirs: Record<string, FileTreeEntry[]>;
  selectedFilePath: string | undefined;
  selectedFileContent: FileContentResponse | undefined;
  fileTreeStale: boolean;
  gitStatus: GitStatusResponse | undefined;
  selectedDiffPath: string | undefined;
  selectedDiff: GitDiffResponse | undefined;
  selectedStagedDiff: GitDiffResponse | undefined;
  gitStale: boolean;
  activeTerminalCount: number;
  onRefreshFiles: () => void;
  onExpandDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onRefreshGit: () => void;
  onSelectDiff: (path: string) => void;
}
```

Useful workspace shape:

```ts
interface Workspace {
  id: string;
  projectId: string;
  path: string;
  label: string;
  branch?: string;
  isMain: boolean;
  isGitRepo: boolean;
  isGitWorktree: boolean;
}
```

Use existing classes such as `toolbar`, `viewer`, `empty`, and `muted` for panel content when possible. Do not assume a panel owns the whole page; keep layout contained.

### Workspace label contributions

Workspace label contributions add compact inline metadata wherever Pi Web displays a workspace label: workspace list, workspace panel header, and status bar.

Use them for short facts like project environment, local URL, branch status, container name, or health state.

```js
workspaceLabelContributions: [
  {
    id: "dev-url",
    order: 10,
    visible: ({ workspace, state }) => {
      const project = state.projects.find((project) => project.id === workspace.projectId);
      return project?.path === "/srv/dev/my-app";
    },
    items: () => ({
      type: "link",
      text: "web:5173",
      href: "http://localhost:5173",
      title: "Open dev server",
      target: "_blank",
    }),
  },
]
```

Label contribution type:

```ts
interface WorkspaceLabelContribution {
  id: string;
  order?: number;
  visible?: (context: WorkspaceLabelContext) => boolean;
  items: (context: WorkspaceLabelContext) => WorkspaceLabelItem | WorkspaceLabelItem[] | undefined;
}

interface WorkspaceLabelContext {
  workspace: Workspace;
  state: AppState;
}
```

Items are sorted by `order` and then id. Return `undefined` to render nothing.

#### Text items

```js
{ type: "text", text: "staging", title: "Staging workspace" }
```

#### Link items

```js
{
  type: "link",
  text: "web:5173",
  href: "http://localhost:5173",
  title: "Open dev server",
  target: "_blank"
}
```

Pi Web renders the anchor and adds safe defaults such as `rel="noopener noreferrer"` for `_blank` links. `javascript:` and `data:` links are rendered as plain text instead of links.

#### Render items

Use render items when a label contribution needs custom UI, async data, or caching. Render items should stay compact and inline.

```js
const { html } = globalThis.piWebPluginApi;

class MyWorkspaceBadge extends HTMLElement {
  set workspace(value) {
    this._workspace = value;
    this.textContent = value?.branch === "main" ? "main" : "branch";
  }
}

if (!customElements.get("my-workspace-badge")) {
  customElements.define("my-workspace-badge", MyWorkspaceBadge);
}

export default {
  id: "my-plugin",
  name: "My Plugin",
  activate: () => ({
    workspaceLabelContributions: [
      {
        id: "badge",
        order: 10,
        items: ({ workspace }) => ({
          type: "render",
          render: () => html`<my-workspace-badge .workspace=${workspace}></my-workspace-badge>`,
        }),
      },
    ],
  }),
};
```

## Reading workspace files

Plugins can use existing Pi Web endpoints. For example, to read a file in a workspace:

```js
async function readWorkspaceFile(workspace, path) {
  const url =
    `/api/projects/${encodeURIComponent(workspace.projectId)}` +
    `/workspaces/${encodeURIComponent(workspace.id)}` +
    `/file?path=${encodeURIComponent(path)}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to read ${path}: ${response.status}`);
  return await response.json();
}
```

Response shape:

```ts
interface FileContentResponse {
  path: string;
  language?: string;
  encoding: "utf8";
  size: number;
  modifiedAt: string;
  content: string;
  truncated: boolean;
  binary: boolean;
}
```

Be careful with sensitive files such as `.env`: plugins are trusted browser code, and file contents are exposed to the plugin.

## Other useful Pi Web APIs

Plugins may call any endpoint available to the browser. Common read endpoints:

```text
GET /api/projects
GET /api/projects/:projectId/workspaces
GET /api/projects/:projectId/workspaces/:workspaceId/tree?path=<dir>
GET /api/projects/:projectId/workspaces/:workspaceId/file?path=<file>
GET /api/projects/:projectId/workspaces/:workspaceId/git/status
GET /api/projects/:projectId/workspaces/:workspaceId/git/diff?path=<file>&staged=true|false
GET /api/sessions?cwd=<workspace-path>
GET /api/sessions/:sessionId/status
GET /api/sessions/:sessionId/messages?before=<cursor>&limit=<n>
```

Common write/action endpoints:

```text
POST /api/sessions                 { "cwd": "/path/to/workspace" }
POST /api/sessions/:id/prompt      { "text": "...", "streamingBehavior": "steer" | "followUp" }
POST /api/sessions/:id/shell       { "text": "..." }
POST /api/sessions/:id/stop
POST /api/sessions/:id/archive
POST /api/sessions/:id/restore
```

Prefer runtime context helpers (`startSession`, `stopActiveWork`, `refreshFiles`, `refreshGit`, etc.) when they cover the interaction. Use direct HTTP calls for plugin-specific data or behavior.

## Async data and caching

Pi Web does not provide a plugin cache/invalidation framework. Keep host callbacks cheap:

- simple contributions should be synchronous and cheap;
- expensive or async work should live inside the plugin;
- custom elements in `type: "render"` label items or panels are a good place to own async loading;
- dedupe fetches and avoid unbounded polling;
- clean up intervals/event listeners in custom elements' `disconnectedCallback()`.

Example cache pattern:

```js
const cache = new Map();
const loading = new Set();

class DevUrlBadge extends HTMLElement {
  set workspace(value) {
    this.workspaceValue = value;
    void this.load();
  }

  async load() {
    const workspace = this.workspaceValue;
    if (!workspace) return;

    if (cache.has(workspace.id)) {
      this.renderUrl(cache.get(workspace.id));
      return;
    }
    if (loading.has(workspace.id)) return;

    loading.add(workspace.id);
    try {
      const file = await readWorkspaceFile(workspace, "docker/development.local.env");
      const url = parseEnv(file.content).BASE_URL;
      cache.set(workspace.id, url);
      this.renderUrl(url);
    } finally {
      loading.delete(workspace.id);
    }
  }

  renderUrl(url) {
    this.textContent = url ?? "";
  }
}
```

## LLM checklist for building a plugin

When asking an LLM to build a Pi Web plugin, give it this checklist:

1. Create a plugin folder with `package.json` and `pi-web-plugin.js`.
2. Use top-level `piWeb` metadata with `id` and `plugin`, or `piWeb.plugins` for multiple modules.
3. Default-export `{ id, name, activate }` from the module.
4. Use ids matching `^[a-z][a-z0-9.-]*$`.
5. Use `globalThis.piWebPluginApi.html` for Lit templates.
6. Keep `activate()` synchronous and cheap; return contribution definitions only.
7. Add actions for command-palette operations.
8. Add workspace panels for larger workspace UI.
9. Add workspace label contributions for compact inline metadata.
10. Use structured text/link label items when possible; use render items/custom elements for async or cached UI.
11. Use `fetch()` against Pi Web APIs for workspace files, git state, sessions, or plugin-specific behavior not provided by runtime context helpers.
12. Treat plugins as trusted code and avoid reading or displaying secrets unless intentional.
13. After local edits, hard reload the browser and check the console for plugin errors.

## Troubleshooting

Check discovery:

```bash
curl http://127.0.0.1:8504/pi-web-plugins/manifest.json
```

Check a plugin module:

```bash
curl http://127.0.0.1:8504/pi-web-plugins/my-plugin/pi-web-plugin.js
```

Common issues:

- invalid plugin id or contribution id;
- missing default export;
- missing `name` or `activate` function;
- missing `package.json` or incorrect `piWeb.plugin` / `piWeb.plugins` metadata;
- entry module path points outside the plugin root or file does not exist;
- browser cache not refreshed after editing;
- plugin directory is not under `~/.pi-web/plugins` or symlinked there;
- duplicate plugin ids cause later plugins to be renamed in the manifest;
- plugin throws during module import, `activate()`, `visible()`, `enabled()`, `items()`, or `render()`; check the browser console.
