import { useState, useCallback, useRef, useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'
import { ClaudekeeperClient } from '@/api/client.ts'
import type { Attention, Message, ResolvedInteraction, Session } from '@/types/session.ts'
import { STORAGE_KEYS } from '@/types/ui.ts'
import { loadFromStorage, saveToStorage, removeFromStorage } from '@/utils/storage.ts'
import { extractTextContent } from '@/utils/content.ts'
import { SESSION_CREATION_REFRESH_DELAY_MS } from '@/utils/constants.ts'

export interface UseSessionReturn {
  // Connection state
  connected: boolean
  loginError: string | null
  connect: () => void

  // Sessions
  sessions: Session[]
  activeSession: Session | undefined
  activeSessionId: string | null
  selectSession: (sessionId: string) => Promise<void>
  createSession: (workdir: string, prompt?: string, name?: string, permissionMode?: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  renameSession: (sessionId: string, name: string) => Promise<void>
  updateSessionPermissionMode: (sessionId: string, mode: string) => Promise<void>
  refreshSessions: () => Promise<void>
  isRefreshing: boolean

  // Messages
  messages: Record<string, Message[]>
  sessionMessages: Message[]
  sendMessage: (text: string) => Promise<void>
  awaitingResponse: boolean

  // Attention
  attention: Attention[]
  sessionAttention: Attention[]
  resolveAttention: (attentionId: string, behavior: 'allow' | 'deny', message?: string) => Promise<void>

  // Interactions
  interactions: Record<string, ResolvedInteraction[]>

  // Client ref for external use (file browser, etc.)
  clientRef: RefObject<ClaudekeeperClient | null>

  // Interrupt
  interruptSession: (sessionId: string) => Promise<void>
}

/**
 * Main hook for session management, WebSocket connection, and message handling.
 * This is the core state management hook for the application.
 */
export function useSession(token: string): UseSessionReturn {
  const [connected, setConnected] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [attention, setAttention] = useState<Attention[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [interactions, setInteractions] = useState<Record<string, ResolvedInteraction[]>>({})
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    // Read from URL hash first, then localStorage
    const hash = window.location.hash
    if (hash.startsWith('#session=')) {
      return hash.slice(9)
    }
    return loadFromStorage<string | null>(STORAGE_KEYS.ACTIVE_SESSION, null)
  })
  const [awaitingResponse, setAwaitingResponse] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const clientRef = useRef<ClaudekeeperClient | null>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const sessionMessages = messages[activeSessionId ?? ''] ?? []
  const sessionAttention = attention.filter(a => a.sessionId === activeSessionId)

  // Sync activeSessionId to URL hash and localStorage
  useEffect(() => {
    if (activeSessionId) {
      saveToStorage(STORAGE_KEYS.ACTIVE_SESSION, activeSessionId)
      const newHash = `#session=${activeSessionId}`
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash)
      }
    } else {
      removeFromStorage(STORAGE_KEYS.ACTIVE_SESSION)
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [activeSessionId])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash
      if (hash.startsWith('#session=')) {
        const sessionId = hash.slice(9)
        if (sessionId !== activeSessionId) {
          setActiveSessionId(sessionId)
          // Load messages if not already loaded (skip pending sessions)
          if (!messages[sessionId] && clientRef.current && !sessionId.startsWith('pending_')) {
            try {
              const session = await clientRef.current.getSession(sessionId)
              if (session.messages) {
                setMessages(prev => ({ ...prev, [sessionId]: session.messages ?? [] }))
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
        let sessionIdToLoad: string | null = null
        if (hash.startsWith('#session=')) {
          sessionIdToLoad = hash.slice(9)
        } else {
          sessionIdToLoad = loadFromStorage<string | null>(STORAGE_KEYS.ACTIVE_SESSION, null)
        }

        // Load the session if it exists
        if (sessionIdToLoad && sessionsData.some(s => s.id === sessionIdToLoad)) {
          setActiveSessionId(sessionIdToLoad)
          try {
            const session = await client.getSession(sessionIdToLoad)
            if (session.messages) {
              setMessages(prev => ({ ...prev, [sessionIdToLoad]: session.messages ?? [] }))
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
        if (sessionId === loadFromStorage<string | null>(STORAGE_KEYS.ACTIVE_SESSION, null)) {
          setAwaitingResponse(false)
        }
      },
      onMessage: (sessionId, message) => {
        setMessages(prev => {
          const existing = prev[sessionId] ?? []
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
        if (sessionId === loadFromStorage<string | null>(STORAGE_KEYS.ACTIVE_SESSION, null)) {
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
          [sessionId]: [...(prev[sessionId] ?? []), interaction]
        }))
      }
    })
  }, [token])

  // Connect on mount if token exists
  useEffect(() => {
    if (token) {
      connect()
    }
    return () => clientRef.current?.disconnect()
  }, []) // Only run once on mount

  const refreshSessions = useCallback(async () => {
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
  }, [isRefreshing])

  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId)
    setAwaitingResponse(false)

    if (!messages[sessionId] && clientRef.current) {
      try {
        const session = await clientRef.current.getSession(sessionId)
        if (session.messages) {
          setMessages(prev => ({ ...prev, [sessionId]: session.messages ?? [] }))
        }
      } catch (e) {
        console.error('Failed to load session history:', e)
      }
    }
  }, [messages])

  const createSession = useCallback(async (
    workdir: string,
    prompt?: string,
    name?: string,
    permissionMode?: string
  ) => {
    if (!clientRef.current) return

    const config = permissionMode && permissionMode !== 'default'
      ? { permissionMode: permissionMode as Session['permissionMode'] }
      : undefined

    // Create a temporary local session placeholder (shows immediately in UI)
    const tempId = `pending_${Date.now()}`
    const now = new Date().toISOString()
    const tempSession: Session = {
      id: tempId,
      workdir,
      ...(name ? { name } : {}),
      status: 'idle',
      config: config ?? {},
      created: now,
      modified: now,
      permissionMode: (permissionMode ?? 'default') as Session['permissionMode'],
      _pendingFor: workdir
    }

    // Add to sessions state immediately (optimistic UI)
    setSessions(prev => [tempSession, ...prev])

    // Navigate to the pending session
    window.location.hash = `session=${tempId}`

    // Fire API call in background
    try {
      await clientRef.current.createSession(workdir, prompt, name, config)
      // Refresh sessions after a delay to get the real session
      setTimeout(async () => {
        try {
          if (!clientRef.current) return
          const freshSessions = await clientRef.current.listSessions()
          setSessions(freshSessions)
          // Find the new session (most recently created one in this workdir)
          const matchingSessions = freshSessions
            .filter(s => s.workdir === workdir && !s.id.startsWith('pending_'))
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
          const newRealSession = matchingSessions[0]
          if (newRealSession && window.location.hash === `#session=${tempId}`) {
            window.location.hash = `session=${newRealSession.id}`
          }
        } catch (e) {
          console.error('Failed to refresh sessions:', e)
        }
      }, SESSION_CREATION_REFRESH_DELAY_MS)
    } catch (err) {
      console.error('Failed to create session on backend:', err)
      // Remove the pending session on failure
      setSessions(prev => prev.filter(s => s.id !== tempId))
      window.location.hash = ''
    }
  }, [])

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!clientRef.current) return
    try {
      await clientRef.current.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      setMessages(prev => {
        const updated = { ...prev }
        delete updated[sessionId]
        return updated
      })
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }, [activeSessionId])

  const renameSession = useCallback(async (sessionId: string, name: string) => {
    if (!clientRef.current) return
    await clientRef.current.renameSession(sessionId, name)
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, name } : s
    ))
  }, [])

  const updateSessionPermissionMode = useCallback(async (sessionId: string, mode: string) => {
    if (!clientRef.current) return
    try {
      await clientRef.current.updateSession(sessionId, { permissionMode: mode as Session['permissionMode'] })
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, permissionMode: mode as Session['permissionMode'] } : s
      ))
    } catch (e) {
      console.error('Failed to update permission mode:', e)
    }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !activeSessionId || !clientRef.current) return

    // Add optimistic user message
    setMessages(prev => ({
      ...prev,
      [activeSessionId]: [...(prev[activeSessionId] ?? []), { role: 'user', content: text, optimistic: true }]
    }))
    setAwaitingResponse(true)
    await clientRef.current.sendMessage(activeSessionId, text)
  }, [activeSessionId])

  const resolveAttention = useCallback(async (
    attentionId: string,
    behavior: 'allow' | 'deny',
    message?: string
  ) => {
    if (!clientRef.current) return
    const resolution = message ? { behavior, message } : { behavior }
    await clientRef.current.resolveAttention(attentionId, resolution)
  }, [])

  const interruptSession = useCallback(async (sessionId: string) => {
    if (!clientRef.current) return
    await clientRef.current.interruptSession(sessionId)
  }, [])

  return {
    connected,
    loginError,
    connect,
    sessions,
    activeSession,
    activeSessionId,
    selectSession,
    createSession,
    deleteSession,
    renameSession,
    updateSessionPermissionMode,
    refreshSessions,
    isRefreshing,
    messages,
    sessionMessages,
    sendMessage,
    awaitingResponse,
    attention,
    sessionAttention,
    resolveAttention,
    interactions,
    clientRef,
    interruptSession
  }
}
