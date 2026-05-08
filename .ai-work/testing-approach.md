# Testing approach

Pi Web should be tested as a set of stable contracts, not as a collection of implementation details. The goal is confidence that users can safely manage projects, workspaces, sessions, and realtime agent interactions as the app evolves.

## Priorities

1. **Safety boundaries**
   - Workspace path normalization and traversal prevention.
   - File read/tree/suggestion APIs never escape the workspace.
   - Git/file operations behave correctly for missing, binary, symlinked, large, and non-directory paths.

2. **Server contracts**
   - Fastify routes return stable status codes and response shapes.
   - Project/workspace/git/session services are covered with real temporary directories and repositories where practical.
   - Session daemon client/proxy behavior is tested separately from the browser-facing API process.

3. **Session lifecycle and realtime behavior**
   - Starting, listing, resuming, archiving/restoring, stopping, and aborting sessions should be tested with fakes at the Pi SDK boundary.
   - WebSocket/event hub tests should verify event routing, global events, disconnect cleanup, and reconnect-safe state.
   - Do not require real Pi credentials in normal CI; use fake runtimes/services for deterministic tests.

4. **Client state and UX-critical flows**
   - Test pure state helpers heavily: routes, chat history merging, transcript/message grouping, input modes, formatting, and API parsing.
   - Browser tests should cover UX behavior, not styling: selecting project/workspace/session, sending a prompt, streaming status, file/git panels, and command-picker flows.
   - Prefer durable `data-testid` selectors for Playwright instead of CSS/style assertions.

## Test layers

### Unit tests

Use Vitest for pure functions and small state transitions. These tests should be fast, deterministic, and edge-case heavy. Good targets include:

- `src/server/workspaces/pathSafety.ts`
- `src/client/src/chatHistoryCache.ts`
- `src/client/src/chatGroups.ts`
- `src/client/src/chatMessages.ts`
- `src/client/src/chatTranscript.ts`
- `src/client/src/inputModes.ts`
- `src/client/src/route.ts`
- `src/client/src/api/parsers.ts`
- formatting and URL helpers

### Service tests

Use real temporary directories via `mkdtemp()` and cleanup after each test. Prefer real filesystem/git behavior over mocks for workspace, file, and git services. Keep tests isolated and avoid depending on the repository checkout.

### API integration tests

Construct Fastify apps in tests, register routes with fake services, and use `app.inject()`. Assert public HTTP contracts: validation, status code, and response body.

### Daemon/protocol tests

Test the split-process session architecture with fake session services and temporary Unix sockets. Critical behavior: daemon unavailable errors, request/response framing, WebSocket proxying, and browser/API disconnects not stopping daemon-owned sessions.

### Browser UX tests

Use Playwright for a small set of happy-path and recovery flows. Do not test colors/layout. Test user-visible behavior: loading empty states, adding/selecting projects, starting sessions, chat updates, file/git panels, and command dialogs.

## Coverage guidance

Coverage numbers are a guardrail, not the goal. Start with moderate global thresholds and raise them as meaningful tests are added. Critical modules should receive targeted tests even if global coverage is already high.

Recommended initial gates once coverage tooling is enabled:

- statements: 70%
- branches: 60%
- functions: 70%
- lines: 70%

## Conventions for future agents

- Add tests near the code under test as `*.test.ts`.
- Prefer testing public functions/contracts over private implementation details.
- When a module is hard to test, first add a small composable seam instead of using broad mocks.
- Use fakes at external boundaries: Pi SDK, daemon process, network, and browser WebSockets.
- Use real temp directories for filesystem behavior.
- Run `npm run verify` before committing.
- Make progressive commits: one commit for test infrastructure/docs, then focused commits for each tested area.
