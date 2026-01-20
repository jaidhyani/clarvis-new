import { h, render } from './lib/preact.mjs'
import { useState, useEffect, useCallback, useRef, useMemo } from './lib/hooks.mjs'
import htm from './lib/htm.mjs'
import { marked } from './lib/marked.esm.js'
import Fuse from './lib/fuse.mjs'
import { ClaudekeeperClient } from './client.js'

const html = htm.bind(h)
const hljs = window.hljs

// Permission modes - single source of truth
const PERMISSION_MODES = [
  { value: 'default', label: 'Default', description: 'Ask before dangerous actions' },
  { value: 'plan', label: 'Plan Mode', description: 'Planning only, no code execution' },
  { value: 'dangerously-skip-permissions', label: 'Skip Permissions', description: 'Skip all permission checks (dangerous)', dangerous: true }
]

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
    const workdir = session.workdir || 'Unknown'
    const name = workdir.split('/').pop() || 'Unknown'
    if (!groups[workdir]) {
      groups[workdir] = { name, workdir, sessions: [] }
    }
    groups[workdir].sessions.push({
      ...session,
      attention: attentionBySession[session.id] || []
    })
  }

  // Sort sessions within each group by modified (most recent first)
  for (const workdir in groups) {
    groups[workdir].sessions.sort((a, b) =>
      new Date(b.modified).getTime() - new Date(a.modified).getTime()
    )
  }

  // Sort workdirs by their most recent session
  const sortedWorkdirs = Object.keys(groups).sort((a, b) => {
    const aLatest = groups[a].sessions[0]?.modified || ''
    const bLatest = groups[b].sessions[0]?.modified || ''
    return new Date(bLatest).getTime() - new Date(aLatest).getTime()
  })

  return sortedWorkdirs.map(workdir => groups[workdir])
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
  // Modal management - stacking pattern for child modals
  // Stack structure: [{ id: 'newSession', data: null }, { id: 'fileBrowser', data: null }]
  const [modalStack, setModalStack] = useState([])

  // Get the current active modal (top of stack)
  const activeModal = modalStack.length > 0 ? modalStack[modalStack.length - 1].id : null
  const modalData = modalStack.length > 0 ? modalStack[modalStack.length - 1].data : null

  // Modal parent-child relationships for stacking behavior
  const MODAL_CHILDREN = {
    'newSession': ['fileBrowser'],
    'workdirConfig': ['fileBrowser']
  }

  // Permission mode change state
  const [pendingPermissionChange, setPendingPermissionChange] = useState(null) // { sessionId, mode }

  const openModal = useCallback((modalId, data = null, isChild = false) => {
    setModalStack(prev => {
      // If this is a child modal of the current modal, push onto stack
      if (prev.length > 0) {
        const currentModal = prev[prev.length - 1].id
        const allowedChildren = MODAL_CHILDREN[currentModal] || []
        if (allowedChildren.includes(modalId)) {
          return [...prev, { id: modalId, data }]
        }
      }
      // Otherwise, replace the entire stack
      return [{ id: modalId, data }]
    })
  }, [])

  const closeModal = useCallback(() => {
    setModalStack(prev => {
      if (prev.length <= 1) return []
      // Pop the top modal, return to parent
      return prev.slice(0, -1)
    })
  }, [])

  const closeAllModals = useCallback(() => {
    setModalStack([])
  }, [])
  const [newSession, setNewSession] = useState({
    workdir: '',
    prompt: '',
    name: '',
    permissionMode: 'default'
  })
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0)
  const searchInputRef = useRef(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const sessionListRef = useRef(null)
  const [inputText, setInputText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [editingSessionName, setEditingSessionName] = useState(null)
  const [editedName, setEditedName] = useState('')
  const [editingHeaderName, setEditingHeaderName] = useState(false)
  const [headerEditName, setHeaderEditName] = useState('')
  // File browser state (used by fileBrowser modal)
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

  // Config data (fetched when workdirConfig modal opens)
  const [sessionConfigModal, setSessionConfigModal] = useState(null) // session id (unused for now)
  const [workdirConfig, setWorkdirConfig] = useState(null) // fetched config data

  // Resolved interactions cache
  const [interactions, setInteractions] = useState({}) // { sessionId: [...] }

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

  // Persist collapse state
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.COLLAPSED_WORKDIRS, collapsedWorkdirs)
  }, [collapsedWorkdirs])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.VISIBLE_COUNTS, visibleCounts)
  }, [visibleCounts])

  // Fetch workdir config when modal opens
  useEffect(() => {
    if (activeModal === 'workdirConfig' && modalData && clientRef.current) {
      clientRef.current.getWorkdirConfig(modalData)
        .then(data => setWorkdirConfig(data))
        .catch(() => setWorkdirConfig({ effective: {} }))
    } else if (activeModal !== 'workdirConfig') {
      setWorkdirConfig(null)
    }
  }, [activeModal, modalData])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes modals
      if (e.key === 'Escape' && modalStack.length > 0) {
        closeModal()
        return
      }
      // Ctrl/Cmd+K focuses search box
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      // Ctrl/Cmd+O toggles detailed view (like Claude Code)
      if ((e.ctrlKey || e.metaKey) && e.key === 'o' && activeSessionId) {
        e.preventDefault()
        setShowTranscript(s => !s)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [modalStack, closeModal, activeSessionId])

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
        setSessions(prev => {
          // Check if there's a pending session for this workdir that should be replaced
          const pendingSession = prev.find(s => s._pendingFor === session.workdir)
          if (pendingSession) {
            // Update URL if we're viewing the pending session
            if (window.location.hash === `#session=${pendingSession.id}`) {
              window.location.hash = `session=${session.id}`
            }
            // Replace pending with real session
            return prev.map(s => s.id === pendingSession.id ? session : s)
          }
          // No pending session, just add normally
          return [...prev.filter(s => s.id !== session.id), session]
        })
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
      },
      onInteractionResolved: (sessionId, interaction) => {
        setInteractions(prev => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] || []), interaction]
        }))
      }
    })
  }, [token])

  useEffect(() => {
    if (token) {
      connect()
    }
    return () => clientRef.current?.ws?.close()
  }, [])

  // Refresh session list from server
  const refreshSessions = async () => {
    if (!clientRef.current || isRefreshing) return
    setIsRefreshing(true)
    try {
      const [sessionsData, attentionData] = await Promise.all([
        clientRef.current.listSessions(),
        clientRef.current.getAttention()
      ])
      setSessions(sessionsData)
      setAttention(attentionData)
    } catch (e) {
      console.error('Failed to refresh sessions:', e)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Pull-to-refresh for mobile
  useEffect(() => {
    const sessionList = sessionListRef.current
    if (!sessionList) return

    let startY = 0
    let isPulling = false

    const handleTouchStart = (e) => {
      if (sessionList.scrollTop === 0) {
        startY = e.touches[0].clientY
        isPulling = true
      }
    }

    const handleTouchMove = (e) => {
      if (!isPulling) return
      const currentY = e.touches[0].clientY
      const pullDistance = currentY - startY

      if (pullDistance > 80 && sessionList.scrollTop === 0) {
        sessionList.classList.add('pulling')
      }
    }

    const handleTouchEnd = () => {
      if (sessionList.classList.contains('pulling')) {
        sessionList.classList.remove('pulling')
        refreshSessions()
      }
      isPulling = false
      startY = 0
    }

    sessionList.addEventListener('touchstart', handleTouchStart, { passive: true })
    sessionList.addEventListener('touchmove', handleTouchMove, { passive: true })
    sessionList.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      sessionList.removeEventListener('touchstart', handleTouchStart)
      sessionList.removeEventListener('touchmove', handleTouchMove)
      sessionList.removeEventListener('touchend', handleTouchEnd)
    }
  }, [connected, isRefreshing])

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

  const openFileBrowser = (initialPath = '') => {
    openModal('fileBrowser')
    loadBrowsePath(initialPath)
  }

  const selectDirectory = (path) => {
    setNewSession(s => ({ ...s, workdir: path }))
    // Close just the file browser, returning to parent modal
    closeModal()
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

  const handleCreateSession = async () => {
    if (!newSession.workdir) return

    try {
      const config = newSession.permissionMode !== 'default'
        ? { permissionMode: newSession.permissionMode }
        : undefined

      // Auto-name from first message if no name provided (max 128 chars)
      let sessionName = newSession.name
      if (!sessionName && newSession.prompt) {
        sessionName = newSession.prompt.slice(0, 128).trim()
        // Truncate at last word boundary if we hit the limit
        if (newSession.prompt.length > 128 && sessionName.includes(' ')) {
          sessionName = sessionName.slice(0, sessionName.lastIndexOf(' ')) + '...'
        }
      }

      // Create a temporary local session placeholder (shows immediately in UI)
      const tempId = `pending_${Date.now()}`
      const tempSession = {
        id: tempId,
        workdir: newSession.workdir,
        name: sessionName || null,
        status: 'idle',
        config: config || {},
        messages: [],
        createdAt: new Date().toISOString(),
        _pendingFor: newSession.workdir // Used to match with real session when it arrives
      }

      // Add to sessions state immediately (optimistic UI)
      setSessions(prev => [tempSession, ...prev])

      closeAllModals()
      setNewSession({ workdir: '', prompt: '', name: '', permissionMode: 'default' })

      // Navigate to the pending session
      window.location.hash = `session=${tempId}`

      // Fire API call in background (don't block UI)
      clientRef.current.createSession(
        newSession.workdir,
        newSession.prompt || undefined,
        sessionName || undefined,
        config
      ).then(() => {
        // Refresh sessions after a delay to get the real session
        // (replaces the pending placeholder with actual session from backend)
        setTimeout(async () => {
          try {
            const freshSessions = await clientRef.current.listSessions()
            setSessions(freshSessions)
            // Find the new session (most recently created one in this workdir)
            const matchingSessions = freshSessions
              .filter(s => s.workdir === newSession.workdir && !s.id.startsWith('pending_'))
              .sort((a, b) => new Date(b.created || b.createdAt) - new Date(a.created || a.createdAt))
            const newRealSession = matchingSessions[0]
            if (newRealSession && window.location.hash === `#session=${tempId}`) {
              window.location.hash = `session=${newRealSession.id}`
            }
          } catch (e) {
            console.error('Failed to refresh sessions:', e)
          }
        }, 2000)
      }).catch(err => {
        console.error('Failed to create session on backend:', err)
        // Remove the pending session on failure
        setSessions(prev => prev.filter(s => s.id !== tempId))
        window.location.hash = ''
      })
    } catch (err) {
      console.error('Failed to create session:', err)
    }
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

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    const searchableItems = sessions.map(s => ({
      ...s,
      workdirName: getWorkdirName(s.workdir),
      displayName: s.name || s.id.slice(0, 12)
    }))
    return new Fuse(searchableItems, {
      keys: ['displayName', 'name', 'workdirName', 'workdir'],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true
    })
  }, [sessions])

  // Filter groups by search query
  const searchFilteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups

    const results = fuse.search(searchQuery)
    const matchedSessionIds = new Set(results.map(r => r.item.id))
    const matchedWorkdirs = new Set()

    // Check if any workdir names match the search
    const workdirFuse = new Fuse(groups.map(g => ({ workdir: g.workdir, name: g.name })), {
      keys: ['name', 'workdir'],
      threshold: 0.4,
      includeScore: true
    })
    const workdirResults = workdirFuse.search(searchQuery)
    workdirResults.forEach(r => matchedWorkdirs.add(r.item.workdir))

    return groups.map(g => {
      // If workdir matches, include all sessions
      if (matchedWorkdirs.has(g.workdir)) {
        return g
      }
      // Otherwise only include matched sessions
      return {
        ...g,
        sessions: g.sessions.filter(s => matchedSessionIds.has(s.id))
      }
    }).filter(g => g.sessions.length > 0)
  }, [groups, searchQuery, fuse])

  // Apply attention filter on top of search filter
  const filteredGroups = filter === 'attention'
    ? searchFilteredGroups.map(g => ({ ...g, sessions: g.sessions.filter(s => s.attention.length > 0) })).filter(g => g.sessions.length > 0)
    : searchFilteredGroups

  // Auto-expand workdirs that have search matches
  const searchExpandedWorkdirs = useMemo(() => {
    if (!searchQuery.trim()) return {}
    const expanded = {}
    filteredGroups.forEach(g => {
      expanded[g.workdir] = false // false means NOT collapsed (expanded)
    })
    return expanded
  }, [searchQuery, filteredGroups])

  // Get effective collapsed state (search overrides manual collapse)
  const isWorkdirCollapsed = (workdir) => {
    if (searchQuery.trim()) {
      return searchExpandedWorkdirs[workdir] ?? true
    }
    return collapsedWorkdirs[workdir] ?? false
  }

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

  // Handle permission mode changes with confirmation for dangerous mode
  const handlePermissionModeChange = async (sessionId, newMode) => {
    if (newMode === 'dangerously-skip-permissions') {
      // Show confirmation dialog
      setPendingPermissionChange({ sessionId, mode: newMode })
    } else {
      // Apply directly
      await applyPermissionModeChange(sessionId, newMode)
    }
  }

  const applyPermissionModeChange = async (sessionId, newMode) => {
    try {
      await clientRef.current.updateSession(sessionId, { permissionMode: newMode })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, permissionMode: newMode } : s
      ))
    } catch (e) {
      console.error('Failed to update permission mode:', e)
    }
    setPendingPermissionChange(null)
  }

  const cancelPermissionChange = () => {
    setPendingPermissionChange(null)
  }

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

  return html`
    <div class="app">
      <div class="sidebar ${sidebarOpen ? 'open' : ''}">
        <div class="sidebar-header">
          <div class="sidebar-title-row">
            <h2>Sessions</h2>
            <button
              class="btn-icon refresh-btn ${isRefreshing ? 'refreshing' : ''}"
              onClick=${refreshSessions}
              disabled=${isRefreshing}
              title="Refresh sessions"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"/>
                <path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button
              class="btn-icon collapse-all-btn"
              onClick=${collapseAllWorkdirs}
              title=${Object.keys(collapsedWorkdirs).length > 0 && Object.values(collapsedWorkdirs).every(Boolean) ? 'Expand all' : 'Collapse all'}
            >
              ${Object.keys(collapsedWorkdirs).length > 0 && Object.values(collapsedWorkdirs).every(Boolean) ? '▶' : '▼'}
            </button>
          </div>
          <button class="sidebar-close" onClick=${() => setSidebarOpen(false)}>×</button>
        </div>
        <div class="sidebar-controls">
          <div class="search-box">
            <input
              type="text"
              ref=${searchInputRef}
              value=${searchQuery}
              onInput=${e => setSearchQuery(e.target.value)}
              onKeyDown=${e => {
                if (e.key === 'Escape') {
                  setSearchQuery('')
                  e.target.blur()
                }
              }}
              placeholder="Search sessions... (⌘K)"
            />
            ${searchQuery && html`
              <button class="search-clear" onClick=${() => setSearchQuery('')}>×</button>
            `}
          </div>
          <select value=${filter} onChange=${e => setFilter(e.target.value)}>
            <option value="all">All Sessions</option>
            <option value="attention">Needs Attention</option>
          </select>
          <button class="btn-primary btn-sm" onClick=${() => openModal('newSession')}>+ New</button>
        </div>
        <div class="session-list" ref=${sessionListRef}>
          ${filteredGroups.map(group => {
            const collapsed = isWorkdirCollapsed(group.workdir)
            const visibleCount = getVisibleCount(group.workdir)
            const visibleSessions = group.sessions.slice(0, visibleCount)
            const hiddenCount = group.sessions.length - visibleCount
            const hasMore = hiddenCount > 0

            return html`
              <div class="session-group ${collapsed ? 'collapsed' : ''}" key=${group.workdir}>
                <div class="group-header" onClick=${() => toggleWorkdirCollapse(group.workdir)}>
                  <span class="collapse-icon">${collapsed ? '▶' : '▼'}</span>
                  <span class="workdir-name" title=${group.workdir}>${getWorkdirName(group.workdir)}</span>
                  <span class="session-count">(${group.sessions.length})</span>
                  <button
                    class="btn-icon new-session-btn"
                    onClick=${(e) => {
                      e.stopPropagation()
                      setNewSession(s => ({ ...s, workdir: group.workdir }))
                      openModal('newSession')
                    }}
                    title="New session in this directory"
                  >+</button>
                  <button
                    class="btn-icon config-btn"
                    onClick=${(e) => {
                      e.stopPropagation()
                      openModal('workdirConfig', group.workdir)
                    }}
                    title="View config"
                  >⚙</button>
                </div>
                ${!collapsed && html`
                  <div class="group-sessions">
                    ${visibleSessions.map(session => html`
                      <div
                        class="session-item ${session.id === activeSessionId ? 'active' : ''} ${session.attention.length > 0 ? 'needs-attention' : ''}"
                        key=${session.id}
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
                                if (e.key === 'Enter') saveRename(session.id)
                                if (e.key === 'Escape') setEditingSessionName(null)
                              }}
                              onBlur=${() => saveRename(session.id)}
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
                        ${session.attention.length > 0 && html`
                          <span class="attention-badge">${session.attention.length}</span>
                        `}
                      </div>
                    `)}
                    ${hasMore && html`
                      <div class="session-overflow">
                        <button onClick=${() => showMoreSessions(group.workdir, 5)}>
                          Show ${Math.min(5, hiddenCount)} more
                        </button>
                        ${hiddenCount > 5 && html`
                          <button onClick=${() => showAllSessions(group.workdir, group.sessions.length)}>
                            Show all (${group.sessions.length})
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
      </div>

      ${sidebarOpen && html`<div class="sidebar-overlay" onClick=${() => setSidebarOpen(false)}></div>`}

      <div class="main">
        <div class="main-header">
          <button class="hamburger" onClick=${() => setSidebarOpen(s => !s)}>
            <span></span><span></span><span></span>
          </button>
          ${activeSession ? html`
            <div class="header-session-info">
              ${editingHeaderName ? html`
                <input
                  type="text"
                  class="header-name-input"
                  value=${headerEditName}
                  onInput=${e => setHeaderEditName(e.target.value)}
                  onKeyDown=${async e => {
                    if (e.key === 'Enter') {
                      await clientRef.current.renameSession(activeSession.id, headerEditName.trim())
                      setSessions(prev => prev.map(s =>
                        s.id === activeSession.id ? { ...s, name: headerEditName.trim() } : s
                      ))
                      setEditingHeaderName(false)
                    }
                    if (e.key === 'Escape') setEditingHeaderName(false)
                  }}
                  onBlur=${async () => {
                    if (headerEditName.trim()) {
                      await clientRef.current.renameSession(activeSession.id, headerEditName.trim())
                      setSessions(prev => prev.map(s =>
                        s.id === activeSession.id ? { ...s, name: headerEditName.trim() } : s
                      ))
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
              <div class="session-meta">
                <span class="session-workdir">${activeSession.workdir}</span>
                <select
                  class="permission-select"
                  value=${activeSession.permissionMode || 'default'}
                  onChange=${e => handlePermissionModeChange(activeSession.id, e.target.value)}
                  title="Permission mode"
                >
                  ${PERMISSION_MODES.map(mode => html`
                    <option key=${mode.value} value=${mode.value}>${mode.label}</option>
                  `)}
                </select>
              </div>
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
            ${getMergedTranscript(
              sessionMessages,
              interactions[activeSessionId]
            ).map((item, i) => {
              if (item.itemType === 'interaction') {
                return html`
                  <div class="message interaction-resolved ${item.resolution === 'allow' ? 'allowed' : 'denied'}" key=${'int-' + i}>
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
              return html`<${Message} key=${'msg-' + i} message=${item} showTranscript=${showTranscript} />`
            })}
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
              <button class="btn-primary" onClick=${() => openModal('newSession')}>Create New Session</button>
            </div>
          </div>
        `}
      </div>

      ${modalStack.length > 0 && html`
        <div class="modal-overlay" onClick=${closeAllModals}>
          ${modalStack.map((modal, index) => {
            const isActive = index === modalStack.length - 1
            const modalId = modal.id
            const data = modal.data
            return html`
              <div
                key=${index}
                class="modal ${modalId === 'workdirConfig' ? 'modal-wide' : ''} ${modalId === 'fileBrowser' ? 'file-browser-modal' : ''} ${!isActive ? 'modal-hidden' : ''}"
                onClick=${e => e.stopPropagation()}
                style=${!isActive ? 'display: none' : ''}
              >
                ${modalId === 'newSession' && html`
                  <div class="modal-header">
                    <h3>New Session</h3>
                    <button class="modal-close" onClick=${closeAllModals}>×</button>
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
                        <button onClick=${() => openFileBrowser('')}>📁</button>
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
                        ${PERMISSION_MODES.map(mode => html`
                          <option key=${mode.value} value=${mode.value}>${mode.description}</option>
                        `)}
                      </select>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button class="btn-secondary" onClick=${closeAllModals}>Cancel</button>
                    <button
                      class="btn-primary"
                      onClick=${handleCreateSession}
                      disabled=${!newSession.workdir}
                    >Create</button>
                  </div>
                `}

                ${modalId === 'fileBrowser' && html`
                  <div class="modal-header">
                    <h3>Select Directory</h3>
                    <button class="modal-close" onClick=${closeModal}>×</button>
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
                    <button class="btn-secondary" onClick=${closeModal}>Cancel</button>
                    <button class="btn-primary" onClick=${() => selectDirectory(browserPath)} disabled=${!browserPath}>
                      Select This Directory
                    </button>
                  </div>
                `}

                ${modalId === 'workdirConfig' && html`
                  <div class="modal-header">
                    <h3>${data}</h3>
                    <button class="modal-close" onClick=${closeAllModals}>×</button>
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
                      onClick=${() => openFileBrowser(data + '/.claude')}
                    >
                      Browse .claude directory
                    </button>
                  </div>
                  <div class="modal-footer">
                    <button class="btn-primary" onClick=${closeAllModals}>Close</button>
                  </div>
                `}
              </div>
            `
          })}
        </div>
      `}

      ${pendingPermissionChange && html`
        <div class="modal-overlay" onClick=${cancelPermissionChange}>
          <div class="modal modal-confirm" onClick=${e => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Confirm Permission Change</h3>
              <button class="modal-close" onClick=${cancelPermissionChange}>×</button>
            </div>
            <div class="modal-body">
              <p class="confirm-warning">
                Are you sure you want to enable <strong>Skip Permissions</strong> mode?
              </p>
              <p class="confirm-details">
                This will skip all permission checks for this session. Claude will be able to
                execute any action without asking for confirmation.
              </p>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onClick=${cancelPermissionChange}>Cancel</button>
              <button
                class="btn-danger"
                onClick=${() => applyPermissionModeChange(pendingPermissionChange.sessionId, pendingPermissionChange.mode)}
              >
                Enable Skip Permissions
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
