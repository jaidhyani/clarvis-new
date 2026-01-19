# Session Continuity Spec

## Overview

Fix session history persistence in Clarvis by correctly integrating with Claude Code's native session storage. Claudekeeper acts as a minimal backend that supplements the SDK - reading session history from `~/.claude`, coordinating attention/permissions, and multiplexing active sessions. Clarvis remains a thin UI client.

## Architecture

```
Browser  ←──→  Clarvis server  ←──→  Claudekeeper  ←──→  SDK  ←──→  Claude API
                (proxy only)         (coordination)        │
                                           │               ↓
                                           └────────→  ~/.claude
                                                    (read history)
```

**Clarvis** = Thin client
- Browser app (Preact UI)
- Server proxies to Claudekeeper + serves static files
- No SDK knowledge, no session logic

**Claudekeeper** = Minimal backend (supplements SDK)
- Web gateway (REST + WebSocket)
- Session discovery (read ~/.claude)
- Attention coordination (canUseTool promise handling)
- Active query multiplexing
- No custom storage - reads what SDK writes

## Goals

- Session history persists across page refresh
- Sessions use Claude Code UUIDs (not separate Claudekeeper IDs)
- History loads from `~/.claude/projects/{workdir}/{uuid}.jsonl`
- Real-time messages stream via WebSocket during active conversation
- Deduplication prevents duplicate messages when WS + history overlap

## Non-Goals

- Editing or deleting messages (history is read-only)
- Multiple workdirs per session
- Custom message storage in Claudekeeper (SDK handles persistence)

## Data Flow

### Session Discovery

```
Clarvis                 Claudekeeper                    Disk
   │                         │                           │
   │──GET /sessions─────────>│                           │
   │                         │──scan ~/.claude/projects/─>│
   │                         │  (filtered by ALLOWED_ROOTS)
   │                         │<──sessions-index.json──────│
   │<──[{id, workdir, ...}]──│                           │
```

### Loading Session History

```
Clarvis                 Claudekeeper                    Disk
   │                         │                           │
   │──GET /sessions/:id─────>│                           │
   │                         │──read {id}.jsonl──────────>│
   │                         │<──JSONL lines──────────────│
   │                         │  (parse user/assistant)    │
   │<──{session, messages}───│                           │
```

### Sending a Message

```
Clarvis       Claudekeeper       SDK        Claude API      Disk
   │                │              │              │            │
   │──POST /send───>│              │              │            │
   │                │──query()────>│              │            │
   │                │              │──request────>│            │
   │                │              │<──stream─────│            │
   │                │              │──write──────────────────->│
   │                │<──message────│              │            │
   │<──WS: message──│              │              │            │
   │                │              │ (continues streaming)     │
```

### Attention/Permission Flow

```
Clarvis       Claudekeeper              SDK
   │                │                    │
   │                │<──canUseTool()─────│  (SDK blocks)
   │                │   (store promise)  │
   │<──WS: attention│                    │
   │                │                    │
   │──POST /resolve>│                    │
   │                │──resolve promise──>│  (SDK resumes)
   │                │                    │
```

## Requirements

### Session Identity
- Session ID = Claude Code UUID (from .jsonl filename)
- No separate `sess_xxx` IDs
- Claudekeeper maps runtime state to Claude UUIDs

### Session Discovery
- Scan `~/.claude/projects/` directories
- Filter to workdirs within ALLOWED_ROOTS
- Read `sessions-index.json` for session metadata
- Return: id (UUID), workdir, firstPrompt, messageCount, created, modified

### History Loading
- Read `{uuid}.jsonl` file for requested session
- Parse JSONL, extract entries with `type: "user"` or `type: "assistant"`
- Return messages as `{role, content, timestamp}`
- Handle corrupted files: return session with error state

### Real-time Messages
- WebSocket broadcasts messages as SDK streams them
- Include session ID so client routes to correct conversation
- Client deduplicates by message content/timestamp if overlap with loaded history

### Claudekeeper State
- **Runtime only**: active queries, pending attention promises
- **Persisted preferences**: user-set session names (stored in Claudekeeper's state.json)
- **No message storage**: always read from ~/.claude

### Error Handling
- Unreadable session files: show session in list with error state
- Missing sessions: 404 response
- SDK errors: broadcast error event, clean up session state

## Technical Approach

### Claudekeeper Rebuild
Gut and rebuild Claudekeeper from scratch (same repo, overwrite existing code). It's an always-on daemon+server.

### Implementation Order
1. Verify SDK message format (what fields exist, when sessionId appears)
2. Rebuild Claudekeeper session discovery (read ~/.claude, return sessions)
3. Implement history loading (parse JSONL correctly)
4. Update Clarvis to use UUIDs and handle optimistic messages
5. End-to-end testing

### Claudekeeper Changes

1. **Remove custom session IDs** - Use Claude UUIDs directly
2. **Rewrite /sessions endpoint** - Scan ~/.claude/projects/ (Clarvis filters by ALLOWED_ROOTS)
3. **Rewrite /sessions/:id endpoint** - Read history from .jsonl file
4. **Capture session ID from SDK** - First message from SDK includes sessionId
5. **Simplify state** - Only track: active queries, attention queue, user preferences

### Clarvis Changes

1. **Use session UUID in URL** - `#session={uuid}` for persistence
2. **Load history on session select** - GET /sessions/:id returns messages
3. **Deduplicate messages** - Compare incoming WS messages against loaded history
4. **Handle error states** - Show appropriate UI for unreadable sessions

### File Structure (Claudekeeper)

```
~/.claude/projects/
  -home-jai-Desktop-myproject/
    sessions-index.json        # List of sessions for this workdir
    abc123-def456-....jsonl    # Session history (UUID)
    xyz789-....jsonl           # Another session

~/.claudekeeper/
  state.json                   # Runtime state + user preferences
  config.json                  # Token, port, etc.
```

## Clarifications

### Session Creation Flow
When user creates a new session:
1. UI shows session in "pending" state (no UUID yet)
2. Claudekeeper calls SDK with prompt
3. First SDK message includes `sessionId` (the UUID)
4. Claudekeeper broadcasts UUID, UI updates session to "active"
5. Session now has real UUID for history loading

### ALLOWED_ROOTS
- ALLOWED_ROOTS is **Clarvis-specific** configuration
- Clarvis uses it to filter results from Claudekeeper
- Claudekeeper returns all discoverable sessions; Clarvis filters by allowed workdirs
- Claudekeeper may add its own path restrictions later (separate concern)

### Message Deduplication
Three message formats exist:
1. **Optimistic outgoing** - User sends message, rendered immediately with no UUID
2. **SDK response** - Real-time stream from SDK during conversation
3. **From-disk JSONL** - Historical messages read from ~/.claude files

Deduplication strategy:
- User messages rendered immediately are marked as `optimistic: true` (no UUID)
- When SDK responds, real message arrives with UUID
- Content-identical message with UUID overwrites optimistic message without UUID
- All other deduplication is by UUID (trivial)

This is simpler than it sounds: optimistic messages are placeholders that get replaced by real messages.

### Migration
- Start fresh - no migration from existing `~/.claudekeeper/state.json`
- Existing `sess_xxx` sessions are abandoned
- All sessions discovered from `~/.claude` going forward

## Open Questions

1. **SDK normalization**: Does the SDK provide tools to normalize message formats, or do we implement our own? (Investigate during implementation)

## Acceptance Criteria

1. **History persists**: Refresh page, messages still visible
2. **Correct session**: Each session shows its own history, not another's
3. **Real-time works**: New messages appear during active conversation
4. **No duplicates**: Messages don't appear twice after refresh during conversation
5. **Session discovery**: All Claude Code sessions from allowed workdirs appear in sidebar
6. **URL persistence**: Refreshing with `#session=uuid` returns to that session
7. **Error handling**: Corrupted sessions show error state, don't crash
