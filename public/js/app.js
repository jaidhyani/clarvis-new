import { h, render } from './lib/preact.mjs'
import { useState, useEffect, useCallback, useRef, useMemo } from './lib/hooks.mjs'
import htm from './lib/htm.mjs'
import { marked } from './lib/marked.esm.js'
import { ClaudekeeperClient } from './client.js'

const html = htm.bind(h)
const hljs = window.hljs

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: (code, lang) => {
    if (lang && hljs?.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs?.highlightAuto(code).value ?? code
  }
})

function renderMarkdown(text) {
  if (!text) return ''
  return marked.parse(text)
}

function extractTextContent(content) {
  if (!content) return ''

  // String content
  if (typeof content === 'string') {
    return content
  }

  // Array of content blocks
  if (Array.isArray(content)) {
    const textParts = content
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text)
    return textParts.join('\n')
  }

  // Object with text property
  if (content.text) {
    return content.text
  }

  return ''
}

function groupByWorkdir(sessions, attention) {
  const attentionBySession = {}
  for (const a of attention) {
    if (!attentionBySession[a.sessionId]) {
      attentionBySession[a.sessionId] = []
    }
    attentionBySession[a.sessionId].push(a)
  }

  const groups = {}
  for (const session of sessions) {
    const workdir = session.workdir || 'unknown'
    const name = workdir.split('/').pop() || 'Unknown'
    if (!groups[workdir]) {
      groups[workdir] = { name, workdir, sessions: [] }
    }
    groups[workdir].sessions.push({
      ...session,
      attention: attentionBySession[session.id] || []
    })
  }

  for (const g of Object.values(groups)) {
    // Sort by modified time (Claude sessions use 'modified' instead of 'lastActivity')
    g.sessions.sort((a, b) => {
      const aTime = new Date(b.modified || b.lastActivity || 0).getTime()
      const bTime = new Date(a.modified || a.lastActivity || 0).getTime()
      return aTime - bTime
    })
  }

  return Object.values(groups).sort((a, b) => {
    const aTime = Math.max(...a.sessions.map(s => new Date(s.modified || s.lastActivity || 0).getTime()))
    const bTime = Math.max(...b.sessions.map(s => new Date(s.modified || s.lastActivity || 0).getTime()))
    return bTime - aTime
  })
}

const SLASH_COMMANDS = [
  { name: 'help', description: 'Show available commands' },
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'compact', description: 'Summarize and compact conversation' },
  { name: 'bug', description: 'Report a bug in the current project' },
  { name: 'config', description: 'View or modify configuration' },
  { name: 'cost', description: 'Show token usage and costs' },
  { name: 'doctor', description: 'Check system health' },
  { name: 'init', description: 'Initialize Claude Code in a project' },
  { name: 'login', description: 'Log in to your account' },
  { name: 'logout', description: 'Log out of your account' },
  { name: 'mcp', description: 'Manage MCP servers' },
  { name: 'memory', description: 'Edit CLAUDE.md memory file' },
  { name: 'model', description: 'Switch AI model' },
  { name: 'permissions', description: 'View or manage permissions' },
  { name: 'pr-comments', description: 'View PR comments' },
  { name: 'review', description: 'Review code changes' },
  { name: 'terminal-setup', description: 'Set up terminal integration' },
  { name: 'vim', description: 'Toggle vim mode' },
  { name: 'add-dir', description: 'Add a directory to context' },
]

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('clarvis_token') || '')
  const [connected, setConnected] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [showToken, setShowToken] = useState(false)
  const [sessions, setSessions] = useState([])
  const [attention, setAttention] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(() => {
    // Read from URL hash first, then localStorage
    const hash = window.location.hash
    if (hash.startsWith('#session=')) {
      return hash.slice(9)
    }
    return localStorage.getItem('clarvis_activeSession') || null
  })
  const [awaitingResponse, setAwaitingResponse] = useState(false)
  const [messages, setMessages] = useState({})
  const [showNewSession, setShowNewSession] = useState(false)
  const [newWorkdir, setNewWorkdir] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [filter, setFilter] = useState('all')
  const [inputText, setInputText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [editingSessionName, setEditingSessionName] = useState(null)
  const [editedName, setEditedName] = useState('')
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [browserPath, setBrowserPath] = useState('')
  const [browserEntries, setBrowserEntries] = useState([])
  const [browserHistory, setBrowserHistory] = useState([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const clientRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const slashMenuRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('clarvis_token', token)
  }, [token])

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('clarvis_activeSession', activeSessionId)
      // Update URL without triggering navigation
      const newHash = `#session=${activeSessionId}`
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash)
      }
    } else {
      localStorage.removeItem('clarvis_activeSession')
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [activeSessionId])

  // Handle browser back/forward and direct URL access
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash
      if (hash.startsWith('#session=')) {
        const sessionId = hash.slice(9)
        if (sessionId !== activeSessionId) {
          setActiveSessionId(sessionId)
          // Load messages if not already loaded
          if (!messages[sessionId] && clientRef.current) {
            try {
              const session = await clientRef.current.getSession(sessionId)
              if (session.messages) {
                setMessages(prev => ({ ...prev, [sessionId]: session.messages }))
              }
            } catch (e) {
              console.error('Failed to load session history:', e)
            }
          }
        }
      } else if (!hash && activeSessionId) {
        setActiveSessionId(null)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [activeSessionId, messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeSessionId])

  const filteredCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS
    const lower = slashFilter.toLowerCase()
    return SLASH_COMMANDS.filter(cmd =>
      cmd.name.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower)
    )
  }, [slashFilter])

  useEffect(() => {
    setSelectedSlashIndex(0)
  }, [filteredCommands])

  const connect = useCallback(() => {
    if (!token) return

    setLoginError(null)
    const client = new ClaudekeeperClient(token)
    clientRef.current = client

    client.subscribe({
      onConnect: async () => {
        setConnected(true)
        setLoginError(null)
        const [sessionsData, attentionData] = await Promise.all([
          client.listSessions(),
          client.getAttention()
        ])
        setSessions(sessionsData)
        setAttention(attentionData)

        // Get session ID from URL hash or localStorage
        const hash = window.location.hash
        let sessionIdToLoad = null
        if (hash.startsWith('#session=')) {
          sessionIdToLoad = hash.slice(9)
        } else {
          sessionIdToLoad = localStorage.getItem('clarvis_activeSession')
        }

        // Load the session if it exists
        if (sessionIdToLoad && sessionsData.some(s => s.id === sessionIdToLoad)) {
          setActiveSessionId(sessionIdToLoad)
          try {
            const session = await client.getSession(sessionIdToLoad)
            if (session.messages) {
              setMessages(prev => ({ ...prev, [sessionIdToLoad]: session.messages }))
            }
          } catch (e) {
            console.error('Failed to restore session history:', e)
          }
        }
      },
      onDisconnect: () => setConnected(false),
      onError: () => setLoginError('Connection failed - check token'),
      onSessionCreated: (session) => {
        setSessions(prev => [...prev.filter(s => s.id !== session.id), session])
      },
      onSessionUpdated: (session) => {
        setSessions(prev => prev.map(s => s.id === session.id ? session : s))
      },
      onSessionEnded: (sessionId) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        setAttention(prev => prev.filter(a => a.sessionId !== sessionId))
        // Clear awaiting response if this session ended
        if (sessionId === localStorage.getItem('clarvis_activeSession')) {
          setAwaitingResponse(false)
        }
      },
      onMessage: (sessionId, message) => {
        setMessages(prev => {
          const existing = prev[sessionId] || []
          // Deduplicate: if this is a user message and we have an optimistic message
          // with matching content, replace the optimistic one
          if (message.role === 'user') {
            const msgContent = extractTextContent(message.content)
            const optimisticIdx = existing.findIndex(m =>
              m.optimistic && m.role === 'user' && extractTextContent(m.content) === msgContent
            )
            if (optimisticIdx !== -1) {
              // Replace optimistic with real message
              const updated = [...existing]
              updated[optimisticIdx] = message
              return { ...prev, [sessionId]: updated }
            }
          }
          return { ...prev, [sessionId]: [...existing, message] }
        })
        // Clear awaiting response when we get a message for the active session
        if (sessionId === localStorage.getItem('clarvis_activeSession')) {
          setAwaitingResponse(false)
        }
      },
      onAttention: (a) => {
        setAttention(prev => [...prev.filter(x => x.id !== a.id), a])
      },
      onAttentionResolved: (attentionId) => {
        setAttention(prev => prev.filter(a => a.id !== attentionId))
      }
    })
  }, [token])

  useEffect(() => {
    if (token) {
      connect()
    }
    return () => clientRef.current?.ws?.close()
  }, [])

  const loadBrowsePath = async (path = '') => {
    try {
      const data = await clientRef.current.browse(path)
      setBrowserEntries(data.entries || [])
      setBrowserPath(data.path || '')
      if (path && !data.isRoot) {
        setBrowserHistory(prev => [...prev, path])
      } else if (!path) {
        setBrowserHistory([])
      }
    } catch (e) {
      console.error('Browse error:', e)
    }
  }

  const openFileBrowser = () => {
    setShowFileBrowser(true)
    loadBrowsePath('')
  }

  const selectDirectory = (path) => {
    setNewWorkdir(path)
    setShowFileBrowser(false)
    setBrowserPath('')
    setBrowserEntries([])
    setBrowserHistory([])
  }

  const navigateUp = () => {
    if (browserHistory.length > 1) {
      const newHistory = browserHistory.slice(0, -1)
      setBrowserHistory(newHistory)
      const parentPath = newHistory[newHistory.length - 1] || ''
      loadBrowsePath(parentPath ? '' : '')
      if (parentPath) {
        clientRef.current.browse(parentPath).then(data => {
          setBrowserEntries(data.entries || [])
          setBrowserPath(data.path || '')
        })
      }
    } else {
      loadBrowsePath('')
    }
  }

  const createSession = async () => {
    if (!newWorkdir) return
    await clientRef.current.createSession(newWorkdir, newPrompt || undefined)
    setShowNewSession(false)
    setNewWorkdir('')
    setNewPrompt('')
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setInputText(value)

    if (value.startsWith('/')) {
      const command = value.slice(1)
      setSlashFilter(command)
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
      setSlashFilter('')
    }
  }

  const selectSlashCommand = (cmd) => {
    setInputText('/' + cmd.name + ' ')
    setShowSlashMenu(false)
    setSlashFilter('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSlashIndex(i => Math.min(i + 1, filteredCommands.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSlashIndex(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        selectSlashCommand(filteredCommands[selectedSlashIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendMessage = async () => {
    if (!inputText.trim() || !activeSessionId) return
    const text = inputText
    setInputText('')
    setShowSlashMenu(false)
    // Add optimistic user message (marked with optimistic flag for deduplication)
    setMessages(prev => ({
      ...prev,
      [activeSessionId]: [...(prev[activeSessionId] || []), { role: 'user', content: text, optimistic: true }]
    }))
    setAwaitingResponse(true)
    await clientRef.current.sendMessage(activeSessionId, text)
  }

  const resolveAttention = async (attentionId, behavior, message) => {
    await clientRef.current.resolveAttention(attentionId, { behavior, message })
  }

  const startRename = (session, e) => {
    e.stopPropagation()
    setEditingSessionName(session.id)
    setEditedName(session.name || '')
  }

  const saveRename = async (sessionId) => {
    if (editedName.trim()) {
      await clientRef.current.renameSession(sessionId, editedName.trim())
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, name: editedName.trim() } : s
      ))
    }
    setEditingSessionName(null)
    setEditedName('')
  }

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const sessionMessages = messages[activeSessionId] || []
  const sessionAttention = attention.filter(a => a.sessionId === activeSessionId)

  const groups = groupByWorkdir(sessions, attention)
  const filteredGroups = filter === 'attention'
    ? groups.map(g => ({ ...g, sessions: g.sessions.filter(s => s.attention.length > 0) })).filter(g => g.sessions.length > 0)
    : groups

  if (!connected) {
    return html`
      <div class="login-container">
        <div class="login-card">
          <h1>Clarvis</h1>
          <p class="login-subtitle">Claude Code Web Interface</p>
          <div class="login-form">
            <div class="password-field">
              <input
                type=${showToken ? 'text' : 'password'}
                placeholder="Enter your token"
                value=${token}
                onInput=${e => setToken(e.target.value)}
                onKeyDown=${e => e.key === 'Enter' && connect()}
              />
              <button type="button" class="toggle-visibility" onClick=${() => setShowToken(s => !s)}>
                ${showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            ${loginError && html`<div class="login-error">${loginError}</div>`}
            <button class="btn-primary" onClick=${connect}>Connect</button>
          </div>
        </div>
      </div>
    `
  }

  const selectSession = async (sessionId) => {
    setActiveSessionId(sessionId)
    setSidebarOpen(false)
    setAwaitingResponse(false)

    if (!messages[sessionId]) {
      try {
        const session = await clientRef.current.getSession(sessionId)
        if (session.messages) {
          setMessages(prev => ({ ...prev, [sessionId]: session.messages }))
        }
      } catch (e) {
        console.error('Failed to load session history:', e)
      }
    }
  }

  const toggleTranscript = () => setShowTranscript(s => !s)

  return html`
    <div class="app">
      <div class="sidebar ${sidebarOpen ? 'open' : ''}">
        <div class="sidebar-header">
          <h2>Sessions</h2>
          <button class="close-sidebar" onClick=${() => setSidebarOpen(false)}>×</button>
        </div>
        <div class="sidebar-controls">
          <select value=${filter} onChange=${e => setFilter(e.target.value)}>
            <option value="all">All Sessions</option>
            <option value="attention">Needs Attention</option>
          </select>
          <button class="btn-primary btn-sm" onClick=${() => setShowNewSession(true)}>+ New</button>
        </div>
        <div class="session-list">
          ${filteredGroups.map(group => html`
            <div class="session-group" key=${group.workdir}>
              <div class="group-header">${group.name}</div>
              ${group.sessions.map(session => html`
                <div
                  class="session-item ${session.id === activeSessionId ? 'active' : ''} ${session.attention.length > 0 ? 'needs-attention' : ''}"
                  key=${session.id}
                  onClick=${() => selectSession(session.id)}
                >
                  <span class="session-indicator ${session.process ? 'running' : 'idle'}"></span>
                  ${editingSessionName === session.id ? html`
                    <input
                      class="session-name-input"
                      value=${editedName}
                      onInput=${e => setEditedName(e.target.value)}
                      onBlur=${() => saveRename(session.id)}
                      onKeyDown=${e => {
                        if (e.key === 'Enter') saveRename(session.id)
                        if (e.key === 'Escape') setEditingSessionName(null)
                      }}
                      onClick=${e => e.stopPropagation()}
                      autoFocus
                    />
                  ` : html`
                    <span class="session-name" onDblClick=${(e) => startRename(session, e)}>
                      ${session.name || session.id.slice(0, 12)}
                    </span>
                  `}
                  ${session.attention.length > 0 && html`
                    <span class="attention-badge">${session.attention.length}</span>
                  `}
                </div>
              `)}
            </div>
          `)}
        </div>
      </div>

      ${sidebarOpen && html`<div class="sidebar-overlay" onClick=${() => setSidebarOpen(false)}></div>`}

      <div class="main">
        <div class="main-header">
          <button class="hamburger" onClick=${() => setSidebarOpen(s => !s)}>
            <span></span><span></span><span></span>
          </button>
          ${activeSession ? html`
            <div class="session-info">
              <h3>${activeSession.name || activeSession.id.slice(0, 16)}</h3>
              <span class="session-workdir">${activeSession.workdir}</span>
            </div>
            <div class="header-actions">
              <button
                class="btn-icon ${showTranscript ? 'active' : ''}"
                onClick=${toggleTranscript}
                title="Toggle detailed view (Ctrl+O)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              </button>
              ${activeSession.process && html`
                <button class="btn-secondary" onClick=${() => clientRef.current.interruptSession(activeSessionId)}>Stop</button>
              `}
              <button class="btn-danger" onClick=${async () => {
                try {
                  await clientRef.current.deleteSession(activeSessionId)
                  setSessions(prev => prev.filter(s => s.id !== activeSessionId))
                  setMessages(prev => {
                    const updated = { ...prev }
                    delete updated[activeSessionId]
                    return updated
                  })
                  setActiveSessionId(null)
                } catch (e) {
                  console.error('Failed to delete session:', e)
                }
              }}>Delete</button>
            </div>
          ` : html`
            <div class="session-info">
              <h3>Clarvis</h3>
            </div>
          `}
        </div>

        ${activeSession ? html`
          <div class="messages">
            ${sessionMessages.map((msg, i) => html`
              <${Message} key=${i} message=${msg} showTranscript=${showTranscript} />
            `)}
            ${sessionAttention.map(a => html`
              <${AttentionCard}
                key=${a.id}
                attention=${a}
                onResolve=${(behavior, message) => resolveAttention(a.id, behavior, message)}
              />
            `)}
            ${awaitingResponse && html`
              <div class="message assistant loading">
                <div class="message-role">Claude</div>
                <div class="loading-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            `}
            <div ref=${messagesEndRef}></div>
          </div>

          <div class="input-container">
            ${showSlashMenu && filteredCommands.length > 0 && html`
              <div class="slash-menu" ref=${slashMenuRef}>
                ${filteredCommands.map((cmd, i) => html`
                  <div
                    class="slash-item ${i === selectedSlashIndex ? 'selected' : ''}"
                    onClick=${() => selectSlashCommand(cmd)}
                    key=${cmd.name}
                  >
                    <span class="slash-name">/${cmd.name}</span>
                    <span class="slash-desc">${cmd.description}</span>
                  </div>
                `)}
              </div>
            `}
            <div class="input-area">
              <button class="slash-trigger" onClick=${() => {
                setInputText('/')
                setShowSlashMenu(true)
                inputRef.current?.focus()
              }} title="Slash commands">/</button>
              <textarea
                ref=${inputRef}
                value=${inputText}
                onInput=${handleInputChange}
                onKeyDown=${handleKeyDown}
                placeholder="Type a message or / for commands..."
                rows="1"
              />
              <button class="btn-send" onClick=${sendMessage} disabled=${!inputText.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
              </button>
            </div>
          </div>
        ` : html`
          <div class="no-session">
            <div class="no-session-content">
              <h2>Welcome to Clarvis</h2>
              <p>Select a session from the sidebar or create a new one to get started.</p>
              <button class="btn-primary" onClick=${() => setShowNewSession(true)}>Create New Session</button>
            </div>
          </div>
        `}
      </div>

      ${showNewSession && html`
        <div class="modal-overlay" onClick=${() => setShowNewSession(false)}>
          <div class="modal" onClick=${e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>New Session</h3>
              <button class="modal-close" onClick=${() => setShowNewSession(false)}>×</button>
            </div>
            <div class="modal-body">
              <label>Working Directory</label>
              <div class="browse-input">
                <input
                  type="text"
                  placeholder="/path/to/project"
                  value=${newWorkdir}
                  onInput=${e => setNewWorkdir(e.target.value)}
                />
                <button class="btn-secondary" onClick=${openFileBrowser}>Browse</button>
              </div>
              <label>Initial Prompt (optional)</label>
              <textarea
                placeholder="What would you like to work on?"
                value=${newPrompt}
                onInput=${e => setNewPrompt(e.target.value)}
              />
            </div>
            <div class="modal-actions">
              <button class="btn-secondary" onClick=${() => setShowNewSession(false)}>Cancel</button>
              <button class="btn-primary" onClick=${createSession} disabled=${!newWorkdir}>Create</button>
            </div>
          </div>
        </div>
      `}

      ${showFileBrowser && html`
        <div class="modal-overlay" onClick=${() => setShowFileBrowser(false)}>
          <div class="modal file-browser-modal" onClick=${e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Select Directory</h3>
              <button class="modal-close" onClick=${() => setShowFileBrowser(false)}>×</button>
            </div>
            <div class="browser-path">
              ${browserPath ? html`
                <button class="btn-icon" onClick=${navigateUp}>←</button>
                <span>${browserPath}</span>
              ` : html`
                <span class="browser-root-label">Select a project root:</span>
              `}
            </div>
            <div class="browser-list">
              ${browserEntries.length === 0 ? html`
                <div class="browser-empty">No directories available</div>
              ` : browserEntries.map(entry => html`
                <div
                  class="browser-item"
                  key=${entry.path}
                  onClick=${() => loadBrowsePath(entry.path)}
                  onDblClick=${() => selectDirectory(entry.path)}
                >
                  <span class="browser-icon">📁</span>
                  <span class="browser-name">${entry.name}</span>
                </div>
              `)}
            </div>
            <div class="modal-actions">
              <button class="btn-secondary" onClick=${() => setShowFileBrowser(false)}>Cancel</button>
              <button class="btn-primary" onClick=${() => selectDirectory(browserPath)} disabled=${!browserPath}>
                Select This Directory
              </button>
            </div>
          </div>
        </div>
      `}
    </div>
  `
}

function Message({ message, showTranscript }) {
  if (!message) return null

  const isInteraction = message.type === 'interaction' || message.type === 'user_interaction'
  const isThinking = message.type === 'thinking' || message.thinking

  // Check for tool_use blocks in content array
  const hasToolUse = Array.isArray(message.content) &&
    message.content.some(b => b.type === 'tool_use')

  if (!showTranscript && (hasToolUse || isThinking)) {
    // Still show text content if present
    const textContent = extractTextContent(message.content)
    if (!textContent) return null
    const role = message.role || 'assistant'
    const roleLabel = role === 'user' ? 'You' : 'Claude'
    return html`
      <div class="message ${role}">
        <div class="message-role">${roleLabel}</div>
        <div class="message-content" dangerouslySetInnerHTML=${{ __html: renderMarkdown(textContent) }}></div>
      </div>
    `
  }

  if (isInteraction) {
    return html`
      <div class="message interaction">
        <div class="interaction-label">User Interaction</div>
        <div class="interaction-question">${message.question || message.summary}</div>
        ${message.answer && html`
          <div class="interaction-answer">
            <strong>Answer:</strong> ${message.answer}
          </div>
        `}
      </div>
    `
  }

  if (isThinking && showTranscript) {
    return html`
      <div class="message thinking">
        <div class="thinking-label">Thinking</div>
        <div class="message-content" dangerouslySetInnerHTML=${{ __html: renderMarkdown(String(message.thinking || message.content)) }}></div>
      </div>
    `
  }

  // Messages from Claude Code sessions have { id, role, content, timestamp }
  const role = message.role || 'assistant'
  const roleLabel = role === 'user' ? 'You' : 'Claude'

  // Extract displayable content
  const content = extractTextContent(message.content)
  if (!content) return null

  return html`
    <div class="message ${role}">
      <div class="message-role">${roleLabel}</div>
      <div class="message-content" dangerouslySetInnerHTML=${{ __html: renderMarkdown(content) }}></div>
      ${showTranscript && hasToolUse && html`
        <div class="tool-uses">
          ${message.content.filter(b => b.type === 'tool_use').map((tool, i) => html`
            <div class="tool-use-inline" key=${i}>
              <span class="tool-name">${tool.name}</span>
              <pre class="tool-input">${JSON.stringify(tool.input, null, 2)}</pre>
            </div>
          `)}
        </div>
      `}
    </div>
  `
}

function AttentionCard({ attention, onResolve }) {
  const [message, setMessage] = useState('')

  if (attention.type === 'permission') {
    // New format uses toolName/toolInput directly, not nested in payload
    const toolName = attention.toolName || attention.payload?.toolName || 'Unknown Tool'
    const input = attention.toolInput || attention.payload?.input || {}
    return html`
      <div class="attention-card permission">
        <div class="attention-header">
          <span class="attention-type">Permission Required</span>
          <span class="attention-tool">${toolName}</span>
        </div>
        <pre class="attention-input">${JSON.stringify(input, null, 2)}</pre>
        <div class="attention-actions">
          <button class="btn-danger" onClick=${() => onResolve('deny', 'User denied')}>Deny</button>
          <button class="btn-success" onClick=${() => onResolve('allow')}>Allow</button>
        </div>
      </div>
    `
  }

  if (attention.type === 'error') {
    return html`
      <div class="attention-card error">
        <div class="attention-header">
          <span class="attention-type">Error</span>
        </div>
        <p class="attention-message">${attention.message}</p>
        <div class="attention-actions">
          <button class="btn-secondary" onClick=${() => onResolve('allow')}>Dismiss</button>
        </div>
      </div>
    `
  }

  if (attention.type === 'completion') {
    return html`
      <div class="attention-card completion">
        <div class="attention-header">
          <span class="attention-type">Completed</span>
        </div>
        <p class="attention-message">${attention.message}</p>
        <div class="attention-actions">
          <button class="btn-primary" onClick=${() => onResolve('allow')}>OK</button>
        </div>
      </div>
    `
  }

  return null
}

render(html`<${App} />`, document.getElementById('app'))
