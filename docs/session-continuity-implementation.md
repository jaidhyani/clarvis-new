# Session Continuity Implementation

This document describes the implementation of session continuity for Clarvis, enabling persistent conversation history across page refreshes and direct URL navigation.

## Architecture

```
Browser <-> Clarvis (proxy) <-> Claudekeeper (coordinator) <-> Claude Code SDK
                                     |
                                     v
                              ~/.claude/projects/
                              (session storage)
```

### Components

1. **Claudekeeper** (`/home/jai/Desktop/claudekeeper/`) - Session coordination server
   - Reads sessions from `~/.claude/projects/`
   - Parses JSONL message files
   - Provides REST API for session listing and retrieval
   - WebSocket for real-time updates

2. **Clarvis** (`/home/jai/Desktop/clarvis-new/`) - Web UI client
   - Proxies requests to Claudekeeper
   - Manages UI state with optimistic updates
   - URL hash routing for deep links

## Session Storage Format

Claude Code stores sessions in `~/.claude/projects/{workdir-path}/{uuid}.jsonl`:

- **workdir-path**: Project directory converted to dashed format (e.g., `/home/jai/Desktop/better` -> `-home-jai-Desktop-better`)
- **uuid**: Session UUID (e.g., `f71a7e8f-269c-4edf-aae2-8c8143a9eec7`)
- **sessions-index.json**: Index file with session metadata

### JSONL Message Format

```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]},"uuid":"...","timestamp":"..."}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]},"uuid":"...","timestamp":"..."}
```

## Implementation Details

### Claudekeeper API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions` | GET | List all sessions across all workdirs |
| `/sessions/:id` | GET | Get session with messages |
| `/sessions/:id/send` | POST | Send message to session |
| `/sessions` | POST | Create new session |
| `/attention` | GET | Get pending attention requests |
| `/attention/:id/resolve` | POST | Resolve attention request |

### Key Files

**Claudekeeper:**
- `src/types.ts` - Type definitions
- `src/claude-sessions.ts` - Session discovery and JSONL parsing
- `src/attention.ts` - Attention request management
- `src/query.ts` - SDK query execution
- `src/server.ts` - HTTP/WebSocket server

**Clarvis:**
- `public/js/app.js` - Main Preact application
- `public/js/client.js` - Claudekeeper API client
- `server.js` - Static server + API proxy

## Features Implemented

### 1. History Persists Across Page Refresh

When the page is refreshed, the active session is restored from the URL hash, and messages are loaded from Claudekeeper.

![History persists after refresh](.playwright-mcp/history-persists-after-refresh.png)

### 2. Correct Session Shows Its Own History

Each session displays its own distinct conversation history. Switching between sessions loads the correct messages.

![Session switching](.playwright-mcp/switched-session.png)

### 3. URL Persistence with `#session=uuid`

Sessions are identified by URL hash (e.g., `#session=f71a7e8f-269c-4edf-aae2-8c8143a9eec7`). Direct navigation to URLs with session hashes loads the correct session.

![Direct URL navigation](.playwright-mcp/direct-url-navigation.png)

### 4. Session Discovery from ~/.claude

All sessions from `~/.claude/projects/` are discovered and grouped by workdir in the sidebar.

![Sessions grouped by workdir](.playwright-mcp/session-loaded.png)

## Surprises and Deviations

### 1. Path Conversion Bug

**Issue:** The `workdirToProjectDir` function initially stripped the leading slash before replacing slashes with dashes.

**Expected directory:** `-home-jai-Desktop-better`
**Got:** `home-jai-Desktop-better` (missing leading dash)

**Fix:** Changed from `workdir.replace(/^\//, '').replace(/\//g, '-')` to `workdir.replace(/\//g, '-')`

### 2. Session IDs are UUIDs

Claude Code uses UUIDs for session identification (e.g., `f71a7e8f-269c-4edf-aae2-8c8143a9eec7`), not custom prefixed IDs like `sess_xxx`.

### 3. Message Content Structure

Messages from Claude Code have a nested content structure:
```json
{"content": [{"type": "text", "text": "..."}]}
```

The `extractTextContent` helper function handles both string and array content formats.

### 4. Sessions Index File

Claude Code maintains a `sessions-index.json` file in each project directory with session metadata, eliminating the need to scan individual JSONL files for basic info.

## Testing

All features were tested using Playwright:

1. **Session loading**: Sessions appear in sidebar grouped by workdir
2. **Message display**: User and assistant messages render with correct roles
3. **URL persistence**: Hash updates when selecting sessions
4. **Page refresh**: History persists after reload
5. **Session switching**: Different sessions show different histories
6. **Direct navigation**: URLs with session hash load correct session

## Configuration

**Claudekeeper** (`~/.claudekeeper/config.json`):
```json
{
  "port": 3100,
  "token": "your-secret-token"
}
```

**Clarvis** (environment variables):
```
PORT=3000
CLAUDEKEEPER_URL=http://localhost:3100
ALLOWED_ROOTS=/home/jai/Desktop
```
