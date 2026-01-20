# Sidebar, Sessions & Config Design

**Date:** 2026-01-19
**Status:** Ready for implementation

## Overview

This design addresses 8 related improvements to Clarvis session management:

1. Collapsible workdir groups in sidebar
2. Full path display on workdirs (tooltip)
3. Relative timestamps on sessions, sorted by most recent
4. Show N most recent sessions with "see more" / "see all"
5. User interactions visible in transcript after resolution
6. Session configuration (permission mode)
7. Per-workdir .claude config viewer
8. Improved session renaming UX + name on creation

## Data Model (Claudekeeper)

### Directory Structure

```
~/.claudekeeper/
├── config.json              # existing (port, token)
└── sessions/
    └── {sessionId}/
        ├── meta.json        # name, config
        └── interactions.jsonl   # resolved attention log
```

### meta.json

```typescript
interface SessionMeta {
  name?: string
  config?: SessionConfig
}

interface SessionConfig {
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  allowedTools?: string[]
  disallowedTools?: string[]
}
```

### interactions.jsonl (append-only)

```typescript
interface ResolvedInteraction {
  id: string
  type: 'permission' | 'error' | 'completion'
  toolName?: string
  toolInput?: unknown
  resolution: 'allow' | 'deny' | 'allowAlways' | string
  message?: string       // user's custom message if provided
  resolvedAt: string     // ISO timestamp
}
```

## API Changes (Claudekeeper)

### Modified Endpoints

**POST /sessions**
```
Body: { workdir: string, prompt?: string, name?: string, config?: SessionConfig }
```
- `prompt` now optional (creates session without initial message)
- `name` and `config` saved to `~/.claudekeeper/sessions/{id}/meta.json`

**PATCH /sessions/:id**
```
Body: { name?: string, config?: SessionConfig }
```
- Updates meta.json
- Config changes take effect on next query

**GET /sessions/:id**
```
Response: { ...session, name, config, interactions: ResolvedInteraction[] }
```
- Merges meta.json data into response
- Includes resolved interactions history

### New Endpoints

**GET /workdir/browse?path={fullpath}**
```
Response: { entries: [{ name: string, type: 'file'|'directory', size: number }] }
```
- Security: path must be within a known session workdir

**GET /workdir/file?path={fullpath}**
```
Response: { content: string, size: number, modified: string }
```
- Security: same restriction, plus size limit (~1MB)

**GET /workdir/config?path={workdir}**
```
Response: { effective: MergedSettings }
```
- Reads and merges settings.json files (global → project → local)

### WebSocket Events

```typescript
{ type: 'session:updated', sessionId: string, changes: { name?: string, config?: SessionConfig } }
{ type: 'interaction:resolved', sessionId: string, interaction: ResolvedInteraction }
```

## Frontend Changes (Clarvis)

### Sidebar Structure

```
.sidebar
├── .sidebar-header
│   ├── "Sessions" title
│   └── [Collapse All] button
├── .sidebar-controls
│   ├── Filter dropdown
│   └── [+ New Session] button
└── .session-list
    └── .session-group (per workdir)
        ├── .group-header
        │   ├── [▶/▼] collapse toggle
        │   ├── Workdir name (tooltip: full path)
        │   └── [⚙] config button
        ├── .session-item (up to N visible)
        │   ├── Status dot
        │   ├── Session name (hover: [✎] edit icon)
        │   ├── Relative time ("2m ago")
        │   └── Attention badge
        └── .session-overflow
            ├── "Show 5 more"
            └── "Show all (23)"
```

### New State Variables

```javascript
const [collapsedWorkdirs, setCollapsedWorkdirs] = useState({})  // persisted to localStorage
const [visibleSessionCounts, setVisibleSessionCounts] = useState({})  // per-workdir
const [workdirConfigModal, setWorkdirConfigModal] = useState(null)  // workdir path
const [sessionConfigModal, setSessionConfigModal] = useState(null)  // session id
const [maxVisibleSessions, setMaxVisibleSessions] = useState(5)
```

### New Session Modal

```
┌─────────────────────────────────────┐
│ New Session                      ✕  │
├─────────────────────────────────────┤
│ Name (optional)                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Workdir *                           │
│ ┌─────────────────────────────┐ [📁]│
│ │ /home/jai/myproject         │     │
│ └─────────────────────────────┘     │
│                                     │
│ Initial prompt (optional)           │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Permissions  [Ask before danger... ▼]│
│              ├─ Ask before dangerous actions
│              ├─ Auto-approve file edits
│              └─ Skip all permission checks
│                                     │
│              [Cancel]  [Create]     │
└─────────────────────────────────────┘
```

### Session Rename UX

**Sidebar:**
```
Default:  ● my-session-name           2m
Hover:    ● my-session-name     [✎]  2m
Edit:     ● [my-session-name____]    2m
```

**Main header:**
```
Default:  my-session-name
Hover:    my-session-name [✎]
Edit:     [my-session-name____]
```

Enter = save, Escape = cancel

### Resolved Interactions in Transcript

```
.message.interaction-resolved
├── Icon (✓ for allow, ✕ for deny)
├── "Allowed Edit to /path/to/file.js"
├── Timestamp
└── User message (if provided)
```

### Workdir Config Modal

```
┌─────────────────────────────────────────────┐
│ /home/jai/myproject                      ✕  │
├─────────────────────────────────────────────┤
│ Effective Settings                          │
│ ┌─────────────────────────────────────────┐ │
│ │ {                                       │ │
│ │   "permissions": { ... },               │ │
│ │   ...                                   │ │
│ │ }                                       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Browse .claude directory]                  │
│                                             │
│                              [Close]        │
└─────────────────────────────────────────────┘
```

## Implementation Order

### Phase 1: Claudekeeper Backend

1. Add `~/.claudekeeper/sessions/{id}/` directory structure
2. Add `meta.json` read/write helpers
3. Add `interactions.jsonl` append/read helpers
4. Add `PATCH /sessions/:id` endpoint
5. Modify `POST /sessions` - optional prompt, accept name/config
6. Modify `GET /sessions/:id` - merge meta, include interactions
7. Add `GET /workdir/browse` and `GET /workdir/file` endpoints
8. Add `GET /workdir/config` convenience endpoint
9. Add WebSocket events for session updates and resolved interactions
10. Pass `permissionMode` to SDK query

### Phase 2: Clarvis Frontend

1. Sidebar: collapsible workdirs with localStorage persistence
2. Sidebar: global collapse-all button
3. Sidebar: fullpath tooltip on workdir headers
4. Sidebar: relative timestamps, sorted by most recent
5. Sidebar: show N sessions with "see more" / "see all"
6. Sidebar: hover effect + edit icon for rename
7. Session creation modal: optional name, optional prompt, permission dropdown
8. Main header: hover edit icon for rename
9. Transcript: show resolved interactions inline
10. Workdir config modal with JSON display + browse button
11. Session config modal (view/edit permission mode)

## Bug Fixes Included

- Session names now persist (was silently failing - no PATCH endpoint)
- Initial prompt now optional (was incorrectly required)
