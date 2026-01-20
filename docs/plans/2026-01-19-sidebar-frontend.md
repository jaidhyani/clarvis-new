# Clarvis Sidebar & Sessions Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement collapsible workdirs, relative timestamps, session limits, rename UX improvements, session config, and workdir config viewer.

**Architecture:** Extend existing Preact app with new state variables, update sidebar rendering, add new modals. Uses localStorage for persisting collapse state.

**Tech Stack:** Preact, htm, vanilla JS, CSS

---

## Task 1: Update Client - Add New API Methods

**Files:**
- Modify: `public/js/client.js`

**Step 1: Add updateSession method for PATCH**

Add after renameSession method:

```javascript
  async updateSession(id, updates) {
    return this.fetch(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  }
```

**Step 2: Add workdir browsing methods**

Add after browse method:

```javascript
  async browseWorkdir(path) {
    return this.fetch(`/workdir/browse?path=${encodeURIComponent(path)}`)
  }

  async readWorkdirFile(path) {
    return this.fetch(`/workdir/file?path=${encodeURIComponent(path)}`)
  }

  async getWorkdirConfig(workdir) {
    return this.fetch(`/workdir/config?path=${encodeURIComponent(workdir)}`)
  }
```

**Step 3: Update createSession to accept name and config**

Update existing createSession method:

```javascript
  async createSession(workdir, prompt, name, config) {
    return this.fetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ workdir, prompt, name, config })
    })
  }
```

**Step 4: Add handler for interaction:resolved event**

Update handleEvent method, add case:

```javascript
      case 'interaction:resolved':
        h.onInteractionResolved?.(event.sessionId, event.interaction)
        break
```

**Step 5: Commit**

```bash
git add public/js/client.js
git commit -m "feat(client): add session update, workdir browse, and interaction APIs"
```

---

## Task 2: Add State Variables and localStorage Helpers

**Files:**
- Modify: `public/js/app.js`

**Step 1: Add localStorage helpers at top of file**

Add after imports, before App function:

```javascript
// localStorage helpers
const STORAGE_KEYS = {
  COLLAPSED_WORKDIRS: 'clarvis_collapsedWorkdirs',
  VISIBLE_COUNTS: 'clarvis_visibleCounts',
  MAX_VISIBLE: 'clarvis_maxVisible'
}

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

// Relative time formatting
function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
```

**Step 2: Add new state variables in App function**

Add after existing useState declarations:

```javascript
  // Sidebar collapse state (persisted)
  const [collapsedWorkdirs, setCollapsedWorkdirs] = useState(() =>
    loadFromStorage(STORAGE_KEYS.COLLAPSED_WORKDIRS, {})
  )
  const [visibleCounts, setVisibleCounts] = useState(() =>
    loadFromStorage(STORAGE_KEYS.VISIBLE_COUNTS, {})
  )
  const [maxVisibleSessions, setMaxVisibleSessions] = useState(() =>
    loadFromStorage(STORAGE_KEYS.MAX_VISIBLE, 5)
  )

  // Config modals
  const [workdirConfigModal, setWorkdirConfigModal] = useState(null) // workdir path
  const [sessionConfigModal, setSessionConfigModal] = useState(null) // session id
  const [workdirConfig, setWorkdirConfig] = useState(null) // fetched config data

  // Resolved interactions cache
  const [interactions, setInteractions] = useState({}) // { sessionId: [...] }
```

**Step 3: Add effects to persist state**

Add after existing useEffect hooks:

```javascript
  // Persist collapse state
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.COLLAPSED_WORKDIRS, collapsedWorkdirs)
  }, [collapsedWorkdirs])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.VISIBLE_COUNTS, visibleCounts)
  }, [visibleCounts])
```

**Step 4: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): add state for collapse, visible counts, and config modals"
```

---

## Task 3: Add Sidebar Helper Functions

**Files:**
- Modify: `public/js/app.js`

**Step 1: Add workdir collapse toggle functions**

Add after the state declarations:

```javascript
  // Workdir collapse functions
  const toggleWorkdirCollapse = (workdir) => {
    setCollapsedWorkdirs(prev => ({
      ...prev,
      [workdir]: !prev[workdir]
    }))
  }

  const collapseAllWorkdirs = () => {
    const allWorkdirs = [...new Set(sessions.map(s => s.workdir))]
    const allCollapsed = allWorkdirs.every(w => collapsedWorkdirs[w])

    if (allCollapsed) {
      setCollapsedWorkdirs({})
    } else {
      const collapsed = {}
      allWorkdirs.forEach(w => { collapsed[w] = true })
      setCollapsedWorkdirs(collapsed)
    }
  }

  // Session visibility functions
  const getVisibleCount = (workdir) => visibleCounts[workdir] || maxVisibleSessions

  const showMoreSessions = (workdir, count) => {
    setVisibleCounts(prev => ({
      ...prev,
      [workdir]: (prev[workdir] || maxVisibleSessions) + count
    }))
  }

  const showAllSessions = (workdir, total) => {
    setVisibleCounts(prev => ({
      ...prev,
      [workdir]: total
    }))
  }

  const resetVisibleCount = (workdir) => {
    setVisibleCounts(prev => {
      const next = { ...prev }
      delete next[workdir]
      return next
    })
  }

  // Get workdir display name (last path segment)
  const getWorkdirName = (workdir) => {
    const parts = workdir.split('/')
    return parts[parts.length - 1] || workdir
  }
```

**Step 2: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): add workdir collapse and session visibility helpers"
```

---

## Task 4: Update Session Grouping to Sort by Modified

**Files:**
- Modify: `public/js/app.js`

**Step 1: Update groupByWorkdir function**

Find the existing groupByWorkdir function and replace:

```javascript
function groupByWorkdir(sessions) {
  const groups = {}
  for (const session of sessions) {
    const workdir = session.workdir || 'Unknown'
    if (!groups[workdir]) groups[workdir] = []
    groups[workdir].push(session)
  }

  // Sort sessions within each group by modified (most recent first)
  for (const workdir in groups) {
    groups[workdir].sort((a, b) =>
      new Date(b.modified).getTime() - new Date(a.modified).getTime()
    )
  }

  // Sort workdirs by their most recent session
  const sortedWorkdirs = Object.keys(groups).sort((a, b) => {
    const aLatest = groups[a][0]?.modified || ''
    const bLatest = groups[b][0]?.modified || ''
    return new Date(bLatest).getTime() - new Date(aLatest).getTime()
  })

  return sortedWorkdirs.map(workdir => ({
    workdir,
    sessions: groups[workdir]
  }))
}
```

**Step 2: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): sort sessions and workdirs by most recent modified"
```

---

## Task 5: Update New Session Modal

**Files:**
- Modify: `public/js/app.js`

**Step 1: Add state for new session form**

Find existing newSession state and update:

```javascript
  const [newSession, setNewSession] = useState({
    workdir: '',
    prompt: '',
    name: '',
    permissionMode: 'default'
  })
```

**Step 2: Update the new session modal HTML**

Find the existing new session modal and replace with:

```javascript
      ${showNewSession && html`
        <div class="modal-overlay" onClick=${() => setShowNewSession(false)}>
          <div class="modal" onClick=${e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>New Session</h3>
              <button class="modal-close" onClick=${() => setShowNewSession(false)}>×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Name (optional)</label>
                <input
                  type="text"
                  value=${newSession.name}
                  onInput=${e => setNewSession(s => ({ ...s, name: e.target.value }))}
                  placeholder="My session"
                />
              </div>
              <div class="form-group">
                <label>Workdir *</label>
                <div class="input-with-button">
                  <input
                    type="text"
                    value=${newSession.workdir}
                    onInput=${e => setNewSession(s => ({ ...s, workdir: e.target.value }))}
                    placeholder="/home/user/project"
                  />
                  <button onClick=${() => setShowBrowser(true)}>📁</button>
                </div>
              </div>
              <div class="form-group">
                <label>Initial prompt (optional)</label>
                <textarea
                  value=${newSession.prompt}
                  onInput=${e => setNewSession(s => ({ ...s, prompt: e.target.value }))}
                  placeholder="What would you like to work on?"
                  rows="3"
                />
              </div>
              <div class="form-group">
                <label>Permissions</label>
                <select
                  value=${newSession.permissionMode}
                  onChange=${e => setNewSession(s => ({ ...s, permissionMode: e.target.value }))}
                >
                  <option value="default">Ask before dangerous actions</option>
                  <option value="acceptEdits">Auto-approve file edits</option>
                  <option value="bypassPermissions">Skip all permission checks</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onClick=${() => setShowNewSession(false)}>Cancel</button>
              <button
                class="btn-primary"
                onClick=${handleCreateSession}
                disabled=${!newSession.workdir}
              >Create</button>
            </div>
          </div>
        </div>
      `}
```

**Step 3: Update handleCreateSession function**

Find and update:

```javascript
  const handleCreateSession = async () => {
    if (!newSession.workdir) return

    try {
      const config = newSession.permissionMode !== 'default'
        ? { permissionMode: newSession.permissionMode }
        : undefined

      await clientRef.current.createSession(
        newSession.workdir,
        newSession.prompt || undefined,
        newSession.name || undefined,
        config
      )

      setShowNewSession(false)
      setNewSession({ workdir: '', prompt: '', name: '', permissionMode: 'default' })
    } catch (err) {
      setError(err.message)
    }
  }
```

**Step 4: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): update new session modal with name and permission mode"
```

---

## Task 6: Update Sidebar Header with Collapse All

**Files:**
- Modify: `public/js/app.js`

**Step 1: Update sidebar header**

Find the sidebar header and update:

```javascript
          <div class="sidebar-header">
            <div class="sidebar-title-row">
              <h2>Sessions</h2>
              <button
                class="btn-icon collapse-all-btn"
                onClick=${collapseAllWorkdirs}
                title=${Object.values(collapsedWorkdirs).every(Boolean) ? 'Expand all' : 'Collapse all'}
              >
                ${Object.values(collapsedWorkdirs).every(Boolean) ? '▶' : '▼'}
              </button>
            </div>
            <button class="sidebar-close" onClick=${() => setSidebarOpen(false)}>×</button>
          </div>
```

**Step 2: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): add collapse all button to sidebar header"
```

---

## Task 7: Update Session Group Rendering

**Files:**
- Modify: `public/js/app.js`

**Step 1: Update session group rendering**

Find the session-list rendering and replace with:

```javascript
          <div class="session-list">
            ${groupByWorkdir(filteredSessions).map(({ workdir, sessions: groupSessions }) => {
              const isCollapsed = collapsedWorkdirs[workdir]
              const visibleCount = getVisibleCount(workdir)
              const visibleSessions = groupSessions.slice(0, visibleCount)
              const hiddenCount = groupSessions.length - visibleCount
              const hasMore = hiddenCount > 0

              return html`
                <div class="session-group ${isCollapsed ? 'collapsed' : ''}">
                  <div class="group-header" onClick=${() => toggleWorkdirCollapse(workdir)}>
                    <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="workdir-name" title=${workdir}>${getWorkdirName(workdir)}</span>
                    <span class="session-count">(${groupSessions.length})</span>
                    <button
                      class="btn-icon config-btn"
                      onClick=${(e) => {
                        e.stopPropagation()
                        setWorkdirConfigModal(workdir)
                      }}
                      title="View config"
                    >⚙</button>
                  </div>
                  ${!isCollapsed && html`
                    <div class="group-sessions">
                      ${visibleSessions.map(session => html`
                        <div
                          class="session-item ${session.id === activeSessionId ? 'active' : ''} ${attention.some(a => a.sessionId === session.id) ? 'needs-attention' : ''}"
                          onClick=${() => selectSession(session.id)}
                        >
                          <span class="session-indicator ${session.process ? 'running' : ''}"></span>
                          <div class="session-info">
                            ${editingSessionName === session.id ? html`
                              <input
                                type="text"
                                class="session-name-input"
                                value=${editedName}
                                onInput=${e => setEditedName(e.target.value)}
                                onKeyDown=${e => {
                                  if (e.key === 'Enter') saveSessionName(session.id)
                                  if (e.key === 'Escape') setEditingSessionName(null)
                                }}
                                onBlur=${() => saveSessionName(session.id)}
                                onClick=${e => e.stopPropagation()}
                                ref=${el => el?.focus()}
                              />
                            ` : html`
                              <span class="session-name-row">
                                <span class="session-name">${session.name || session.id.slice(0, 12)}</span>
                                <button
                                  class="btn-icon edit-btn"
                                  onClick=${(e) => {
                                    e.stopPropagation()
                                    setEditingSessionName(session.id)
                                    setEditedName(session.name || '')
                                  }}
                                  title="Rename"
                                >✎</button>
                              </span>
                            `}
                            <span class="session-time">${formatRelativeTime(session.modified)}</span>
                          </div>
                          ${attention.some(a => a.sessionId === session.id) && html`
                            <span class="attention-badge">${attention.filter(a => a.sessionId === session.id).length}</span>
                          `}
                        </div>
                      `)}
                      ${hasMore && html`
                        <div class="session-overflow">
                          <button onClick=${() => showMoreSessions(workdir, 5)}>
                            Show ${Math.min(5, hiddenCount)} more
                          </button>
                          ${hiddenCount > 5 && html`
                            <button onClick=${() => showAllSessions(workdir, groupSessions.length)}>
                              Show all (${groupSessions.length})
                            </button>
                          `}
                        </div>
                      `}
                    </div>
                  `}
                </div>
              `
            })}
          </div>
```

**Step 2: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): implement collapsible workdirs with session limits and timestamps"
```

---

## Task 8: Add Workdir Config Modal

**Files:**
- Modify: `public/js/app.js`

**Step 1: Add effect to fetch workdir config**

Add after other useEffect hooks:

```javascript
  // Fetch workdir config when modal opens
  useEffect(() => {
    if (workdirConfigModal && clientRef.current) {
      clientRef.current.getWorkdirConfig(workdirConfigModal)
        .then(data => setWorkdirConfig(data))
        .catch(() => setWorkdirConfig({ effective: {} }))
    } else {
      setWorkdirConfig(null)
    }
  }, [workdirConfigModal])
```

**Step 2: Add workdir config modal HTML**

Add before the closing fragment tag:

```javascript
      ${workdirConfigModal && html`
        <div class="modal-overlay" onClick=${() => setWorkdirConfigModal(null)}>
          <div class="modal modal-wide" onClick=${e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>${workdirConfigModal}</h3>
              <button class="modal-close" onClick=${() => setWorkdirConfigModal(null)}>×</button>
            </div>
            <div class="modal-body">
              <h4>Effective Settings</h4>
              <pre class="config-display">${
                workdirConfig
                  ? JSON.stringify(workdirConfig.effective, null, 2)
                  : 'Loading...'
              }</pre>
              <button
                class="btn-secondary"
                onClick=${() => {
                  setShowBrowser(true)
                  setBrowserPath(workdirConfigModal + '/.claude')
                }}
              >
                Browse .claude directory
              </button>
            </div>
            <div class="modal-footer">
              <button class="btn-primary" onClick=${() => setWorkdirConfigModal(null)}>Close</button>
            </div>
          </div>
        </div>
      `}
```

**Step 3: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): add workdir config modal"
```

---

## Task 9: Update Main Header with Rename

**Files:**
- Modify: `public/js/app.js`

**Step 1: Add state for header rename**

Add after editingSessionName state:

```javascript
  const [editingHeaderName, setEditingHeaderName] = useState(false)
  const [headerEditName, setHeaderEditName] = useState('')
```

**Step 2: Update main header to show edit icon and handle rename**

Find the main header section and update:

```javascript
            <div class="main-header">
              <button class="hamburger" onClick=${() => setSidebarOpen(true)}>☰</button>
              ${activeSession && html`
                <div class="header-session-info">
                  ${editingHeaderName ? html`
                    <input
                      type="text"
                      class="header-name-input"
                      value=${headerEditName}
                      onInput=${e => setHeaderEditName(e.target.value)}
                      onKeyDown=${async e => {
                        if (e.key === 'Enter') {
                          await clientRef.current.updateSession(activeSession.id, { name: headerEditName.trim() })
                          setEditingHeaderName(false)
                        }
                        if (e.key === 'Escape') setEditingHeaderName(false)
                      }}
                      onBlur=${async () => {
                        if (headerEditName.trim()) {
                          await clientRef.current.updateSession(activeSession.id, { name: headerEditName.trim() })
                        }
                        setEditingHeaderName(false)
                      }}
                      ref=${el => el?.focus()}
                    />
                  ` : html`
                    <h3 class="header-session-name">
                      ${activeSession.name || activeSession.id.slice(0, 16)}
                      <button
                        class="btn-icon edit-btn"
                        onClick=${() => {
                          setEditingHeaderName(true)
                          setHeaderEditName(activeSession.name || '')
                        }}
                        title="Rename"
                      >✎</button>
                    </h3>
                  `}
                </div>
              `}
              ${/* rest of header buttons */}
            </div>
```

**Step 3: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): add rename functionality to main header"
```

---

## Task 10: Add Interaction Resolved Event Handler

**Files:**
- Modify: `public/js/app.js`

**Step 1: Add handler in connect function**

Find the subscribe handlers and add:

```javascript
        onInteractionResolved: (sessionId, interaction) => {
          setInteractions(prev => ({
            ...prev,
            [sessionId]: [...(prev[sessionId] || []), interaction]
          }))
        },
```

**Step 2: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): handle interaction:resolved events"
```

---

## Task 11: Display Resolved Interactions in Transcript

**Files:**
- Modify: `public/js/app.js`

**Step 1: Update message rendering to include interactions**

Find where messages are rendered and update to interleave interactions:

```javascript
  // Helper to merge messages and interactions chronologically
  const getMergedTranscript = (sessionMessages, sessionInteractions) => {
    const items = [
      ...sessionMessages.map(m => ({ ...m, itemType: 'message' })),
      ...(sessionInteractions || []).map(i => ({ ...i, itemType: 'interaction', timestamp: i.resolvedAt }))
    ]
    return items.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }
```

**Step 2: Update transcript rendering**

In the messages area, update to use merged transcript:

```javascript
              ${getMergedTranscript(
                messages[activeSessionId] || [],
                interactions[activeSessionId]
              ).map(item => {
                if (item.itemType === 'interaction') {
                  return html`
                    <div class="message interaction-resolved ${item.resolution === 'allow' ? 'allowed' : 'denied'}">
                      <span class="interaction-icon">${item.resolution === 'allow' ? '✓' : '✕'}</span>
                      <div class="interaction-content">
                        <span class="interaction-action">
                          ${item.resolution === 'allow' ? 'Allowed' : 'Denied'} ${item.toolName || item.type}
                          ${item.toolInput?.file_path ? ` to ${item.toolInput.file_path}` : ''}
                        </span>
                        ${item.message && html`<span class="interaction-message">"${item.message}"</span>`}
                        <span class="interaction-time">${formatRelativeTime(item.resolvedAt)}</span>
                      </div>
                    </div>
                  `
                }

                // Existing message rendering
                return html`
                  <div class="message ${item.role}">
                    ${/* existing message content */}
                  </div>
                `
              })}
```

**Step 3: Commit**

```bash
git add public/js/app.js
git commit -m "feat(app): display resolved interactions in transcript"
```

---

## Task 12: Add CSS Styles

**Files:**
- Modify: `public/css/main.css`

**Step 1: Add sidebar collapse styles**

Add to main.css:

```css
/* Sidebar title row */
.sidebar-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.collapse-all-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.75rem;
}

.collapse-all-btn:hover {
  color: var(--text-primary);
}

/* Session group styles */
.session-group {
  margin-bottom: 0.5rem;
}

.session-group.collapsed .group-sessions {
  display: none;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 0.25rem;
}

.group-header:hover {
  background: var(--bg-secondary);
}

.collapse-icon {
  font-size: 0.625rem;
  color: var(--text-secondary);
  width: 1rem;
}

.workdir-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-count {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.config-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.group-header:hover .config-btn {
  opacity: 1;
}

/* Session item updates */
.session-info {
  flex: 1;
  min-width: 0;
}

.session-name-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.session-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-btn {
  opacity: 0;
  transition: opacity 0.15s;
  font-size: 0.75rem;
}

.session-item:hover .edit-btn,
.header-session-name:hover .edit-btn {
  opacity: 1;
}

.session-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.session-name-input,
.header-name-input {
  background: var(--bg-tertiary);
  border: 1px solid var(--accent);
  border-radius: 0.25rem;
  color: var(--text-primary);
  padding: 0.25rem 0.5rem;
  font-size: inherit;
  width: 100%;
}

/* Session overflow */
.session-overflow {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.5rem 2rem;
}

.session-overflow button {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
}

.session-overflow button:hover {
  text-decoration: underline;
}
```

**Step 2: Add interaction styles**

```css
/* Resolved interactions */
.interaction-resolved {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.interaction-resolved.allowed {
  border-left: 3px solid var(--success);
}

.interaction-resolved.denied {
  border-left: 3px solid var(--danger);
}

.interaction-icon {
  font-size: 1rem;
}

.interaction-resolved.allowed .interaction-icon {
  color: var(--success);
}

.interaction-resolved.denied .interaction-icon {
  color: var(--danger);
}

.interaction-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.interaction-action {
  color: var(--text-primary);
}

.interaction-message {
  color: var(--text-secondary);
  font-style: italic;
}

.interaction-time {
  color: var(--text-secondary);
  font-size: 0.75rem;
}
```

**Step 3: Add modal and config styles**

```css
/* Wide modal variant */
.modal.modal-wide {
  max-width: 600px;
  width: 90vw;
}

/* Config display */
.config-display {
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
  padding: 1rem;
  overflow: auto;
  max-height: 300px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

/* Header session name */
.header-session-info {
  flex: 1;
  min-width: 0;
}

.header-session-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.header-name-input {
  font-size: 1rem;
  font-weight: 500;
}

/* Form group for modal */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.form-group select {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  color: var(--text-primary);
}

.input-with-button {
  display: flex;
  gap: 0.5rem;
}

.input-with-button input {
  flex: 1;
}

.input-with-button button {
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  cursor: pointer;
}
```

**Step 4: Commit**

```bash
git add public/css/main.css
git commit -m "feat(css): add styles for collapsible sidebar, interactions, and modals"
```

---

## Task 13: Final Integration Test

**Step 1: Start both servers**

```bash
# Terminal 1: Claudekeeper
cd /home/jai/Desktop/claudekeeper && npm start

# Terminal 2: Clarvis
cd /home/jai/Desktop/clarvis-new && npm start
```

**Step 2: Test features in browser**

1. Open http://localhost:3000
2. Test collapsing/expanding workdir groups
3. Test "Collapse All" button
4. Test "Show more" / "Show all" session overflow
5. Test renaming session in sidebar (hover, click edit icon)
6. Test renaming session in header
7. Test creating session with name and permission mode
8. Test workdir config modal (click ⚙ on workdir)
9. Verify timestamps show relative time

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete sidebar and session management frontend"
```
