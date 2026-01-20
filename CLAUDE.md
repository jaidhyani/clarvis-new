# Clarvis Development Guide

## Architecture Overview

Clarvis is a TypeScript web UI client for Claudekeeper (the Claude Code session manager). The frontend is built with Preact + Vite, and the server handles static files, API proxying, and filesystem browsing.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser        │────▶│  Clarvis Server  │────▶│  Claudekeeper   │
│  (Preact App)   │◀────│  (Node + TS)     │◀────│  (Claude Code)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Project Structure

```
src/
├── main.tsx              # Entry point, renders App
├── App.tsx               # Main orchestration (~280 lines)
├── types/                # TypeScript type definitions
│   ├── session.ts        # Session, Message, Attention types
│   ├── api.ts            # API request/response types
│   └── ui.ts             # UI state types (modal, filter)
├── api/
│   └── client.ts         # ClaudekeeperClient (typed WebSocket + REST)
├── hooks/                # Custom React hooks (state management)
│   ├── useSession.ts     # Core session state, WebSocket, messages
│   ├── useModal.ts       # Modal stack management
│   ├── useFileBrowser.ts # File browser navigation
│   ├── useSlashCommands.ts # Slash command menu state
│   ├── useSessionGroups.ts # Session grouping + search
│   ├── useRename.ts      # Inline rename logic
│   ├── usePullToRefresh.ts # Mobile touch handling
│   └── useStorage.ts     # localStorage wrapper
├── components/
│   ├── LoginView.tsx     # Token input screen
│   ├── Sidebar/          # Session list sidebar
│   ├── Chat/             # Messages, input, header
│   ├── Modal/            # Modal dialogs
│   └── common/           # Shared components
├── utils/
│   ├── content.ts        # Message content extraction
│   ├── time.ts           # Relative time formatting
│   ├── markdown.ts       # Markdown rendering (cached)
│   ├── storage.ts        # localStorage helpers
│   └── constants.ts      # Slash commands, defaults
└── server/               # Node.js server
    ├── index.ts          # Entry point
    ├── config.ts         # Environment config
    └── routes/           # Request handlers
```

## Key Abstractions

### Hooks (State Management)

**useSession** - The core hook. Manages:
- WebSocket connection to Claudekeeper
- Sessions list and active session
- Messages per session (with optimistic updates)
- Attention items (permission requests, errors)
- Resolved interactions for transcript

**useModal** - Modal stack with parent-child relationships:
- newSession can open fileBrowser as child
- workdirConfig can open fileBrowser as child
- Closing child returns to parent

**useSessionGroups** - Computes grouped/filtered view:
- Groups sessions by workdir
- Fuzzy search across sessions and workdir names
- Attention filter overlay

### Components

**App.tsx** - Orchestration only. Composes hooks and components, handles global keyboard shortcuts.

**Sidebar** - Session list with search, filter, collapse/expand. Uses pull-to-refresh on mobile.

**MessageList** - Displays messages and attention cards. Merges messages with resolved interactions chronologically.

**MessageInput** - Input with slash command autocomplete menu.

### Types

All data shapes are defined in `src/types/`:
- **Session**: id, workdir, name, status, permissionMode, created, modified
- **Message**: role, content (string or ContentBlock[]), timestamp, optimistic flag
- **Attention**: id, sessionId, type (permission/error/completion), toolName/toolInput
- **ContentBlock**: TextContentBlock | ToolUseContentBlock | ToolResultContentBlock

## Data Flow

1. **Login**: Token stored in localStorage, triggers `useSession.connect()`
2. **Connect**: ClaudekeeperClient opens WebSocket, fetches initial sessions/attention
3. **Session select**: Hash URL updated, messages fetched if not cached
4. **Send message**: Optimistic message added, server message replaces it
5. **WebSocket events**: Update sessions, messages, attention in real-time
6. **Attention resolve**: User allows/denies, removed from state

## Server Endpoints

- `/*` - Static files (dist/ in production, public/ for dev)
- `/api/*` - Proxied to Claudekeeper (CLAUDEKEEPER_URL env var)
- `/ws` - WebSocket proxy to Claudekeeper
- `/api/browse?path=` - Filesystem browser (respects ALLOWED_ROOTS)

## Development

```bash
# Start dev server (Vite HMR)
npm run dev

# Start backend server
npm run server:dev

# Type check
npm run typecheck

# Run tests
npm run test

# Build for production
npm run build
```

## Common Tasks

### Adding a new feature

1. Define types in `src/types/` if needed
2. Add API methods to `ClaudekeeperClient` if backend involved
3. Create or extend hook in `src/hooks/`
4. Create component(s) in appropriate folder
5. Wire into `App.tsx`

### Adding a new modal

1. Add type to `ModalType` in `src/types/ui.ts`
2. Update `MODAL_CHILDREN` if it can open child modals
3. Create component in `src/components/Modal/`
4. Add rendering case in `ModalContainer.tsx`

### Adding a hook

1. Create file in `src/hooks/` following naming pattern
2. Export from `src/hooks/index.ts`
3. Write tests in `*.test.ts`

## TypeScript Configuration

Using strict mode with maximum type safety:
- `strict: true`, `noImplicitAny`, `strictNullChecks`
- `exactOptionalPropertyTypes` - can't assign undefined to optional
- `noUncheckedIndexedAccess` - array access may be undefined

## Testing

Tests use Vitest with Preact Testing Library. Located next to source files:
- `src/utils/content.test.ts`
- `src/utils/time.test.ts`
- `src/hooks/useModal.test.ts`

Run with `npm run test` (watch) or `npm run test:run` (CI).

## Notes

- The old JavaScript files in `public/js/` are now unused and can be removed
- CSS remains in `public/css/main.css` - not migrated to CSS-in-JS
- highlight.js adds significant bundle size - could be lazy loaded if needed
