import { h, render } from './lib/preact.mjs'
import { useState, useEffect, useCallback, useRef } from './lib/hooks.mjs'
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
    g.sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
  }

  return Object.values(groups).sort((a, b) => {
    const aTime = Math.max(...a.sessions.map(s => new Date(s.lastActivity).getTime()))
    const bTime = Math.max(...b.sessions.map(s => new Date(s.lastActivity).getTime()))
    return bTime - aTime
  })
}

function App() {
  const [config, setConfig] = useState(() => {
    const stored = localStorage.getItem('clarvis_config')
    return stored ? JSON.parse(stored) : { url: 'http://localhost:3100', token: '' }
  })
  const [connected, setConnected] = useState(false)
  const [sessions, setSessions] = useState([])
  const [attention, setAttention] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState({})
  const [showNewSession, setShowNewSession] = useState(false)
  const [newWorkdir, setNewWorkdir] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [filter, setFilter] = useState('all')
  const [inputText, setInputText] = useState('')
  const clientRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('clarvis_config', JSON.stringify(config))
  }, [config])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeSessionId])

  const connect = useCallback(() => {
    if (!config.url || !config.token) return

    const client = new ClaudekeeperClient(config.url, config.token)
    clientRef.current = client

    client.subscribe({
      onConnect: async () => {
        setConnected(true)
        const [sessionsData, attentionData] = await Promise.all([
          client.listSessions(),
          client.getAttention()
        ])
        setSessions(sessionsData)
        setAttention(attentionData)
      },
      onDisconnect: () => setConnected(false),
      onSessionCreated: (session) => {
        setSessions(prev => [...prev.filter(s => s.id !== session.id), session])
      },
      onSessionUpdated: (session) => {
        setSessions(prev => prev.map(s => s.id === session.id ? session : s))
      },
      onSessionEnded: (sessionId) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        setAttention(prev => prev.filter(a => a.sessionId !== sessionId))
      },
      onMessage: (sessionId, message) => {
        setMessages(prev => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] || []), message]
        }))
      },
      onAttention: (a) => {
        setAttention(prev => [...prev.filter(x => x.id !== a.id), a])
      },
      onAttentionResolved: (attentionId) => {
        setAttention(prev => prev.filter(a => a.id !== attentionId))
      }
    })
  }, [config])

  useEffect(() => {
    if (config.url && config.token) {
      connect()
    }
    return () => clientRef.current?.ws?.close()
  }, [])

  const createSession = async () => {
    if (!newWorkdir) return
    await clientRef.current.createSession(newWorkdir, newPrompt || undefined)
    setShowNewSession(false)
    setNewWorkdir('')
    setNewPrompt('')
  }

  const sendMessage = async () => {
    if (!inputText.trim() || !activeSessionId) return
    await clientRef.current.sendMessage(activeSessionId, inputText)
    setInputText('')
  }

  const resolveAttention = async (attentionId, behavior, message) => {
    await clientRef.current.resolveAttention(attentionId, { behavior, message })
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
        <h1>Clarvis</h1>
        <div class="login-form">
          <input
            type="text"
            placeholder="Claudekeeper URL"
            value=${config.url}
            onInput=${e => setConfig(c => ({ ...c, url: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Token"
            value=${config.token}
            onInput=${e => setConfig(c => ({ ...c, token: e.target.value }))}
          />
          <button onClick=${connect}>Connect</button>
        </div>
      </div>
    `
  }

  return html`
    <div class="app">
      <div class="sidebar">
        <div class="sidebar-header">
          <h2>Sessions</h2>
          <div class="sidebar-actions">
            <select value=${filter} onChange=${e => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="attention">Needs Attention</option>
            </select>
            <button onClick=${() => setShowNewSession(true)}>+ New</button>
          </div>
        </div>
        <div class="session-list">
          ${filteredGroups.map(group => html`
            <div class="session-group" key=${group.workdir}>
              <div class="group-header">${group.name}</div>
              ${group.sessions.map(session => html`
                <div
                  class="session-item ${session.id === activeSessionId ? 'active' : ''} ${session.attention.length > 0 ? 'needs-attention' : ''}"
                  key=${session.id}
                  onClick=${() => setActiveSessionId(session.id)}
                >
                  <span class="session-indicator ${session.process ? 'running' : 'idle'}"></span>
                  <span class="session-name">${session.name || session.id.slice(0, 12)}</span>
                  ${session.attention.length > 0 && html`
                    <span class="attention-badge">${session.attention.length}</span>
                  `}
                </div>
              `)}
            </div>
          `)}
        </div>
      </div>

      <div class="main">
        ${activeSession ? html`
          <div class="session-header">
            <div class="session-title">
              <h3>${activeSession.name || activeSession.id}</h3>
              <span class="session-workdir">${activeSession.workdir}</span>
            </div>
            <div class="session-actions">
              ${activeSession.process && html`
                <button onClick=${() => clientRef.current.interruptSession(activeSessionId)}>Stop</button>
              `}
              <button class="danger" onClick=${() => clientRef.current.deleteSession(activeSessionId)}>Delete</button>
            </div>
          </div>

          <div class="messages">
            ${sessionMessages.map((msg, i) => html`
              <${Message} key=${i} message=${msg} />
            `)}
            ${sessionAttention.map(a => html`
              <${AttentionCard}
                key=${a.id}
                attention=${a}
                onResolve=${(behavior, message) => resolveAttention(a.id, behavior, message)}
              />
            `)}
            <div ref=${messagesEndRef}></div>
          </div>

          <div class="input-area">
            <textarea
              value=${inputText}
              onInput=${e => setInputText(e.target.value)}
              onKeyDown=${e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Type a message..."
              disabled=${!activeSession.process || activeSession.process.state !== 'awaiting_input'}
            />
            <button onClick=${sendMessage} disabled=${!inputText.trim()}>Send</button>
          </div>
        ` : html`
          <div class="no-session">
            <p>Select a session or create a new one</p>
          </div>
        `}
      </div>

      ${showNewSession && html`
        <div class="modal-overlay" onClick=${() => setShowNewSession(false)}>
          <div class="modal" onClick=${e => e.stopPropagation()}>
            <h3>New Session</h3>
            <input
              type="text"
              placeholder="Working directory"
              value=${newWorkdir}
              onInput=${e => setNewWorkdir(e.target.value)}
            />
            <textarea
              placeholder="Initial prompt (optional)"
              value=${newPrompt}
              onInput=${e => setNewPrompt(e.target.value)}
            />
            <div class="modal-actions">
              <button onClick=${() => setShowNewSession(false)}>Cancel</button>
              <button onClick=${createSession} disabled=${!newWorkdir}>Create</button>
            </div>
          </div>
        </div>
      `}
    </div>
  `
}

function Message({ message }) {
  if (!message) return null

  const content = message.content || message.text || message.result
  if (!content) return null

  const role = message.role || (message.type === 'assistant' ? 'assistant' : 'user')

  return html`
    <div class="message ${role}">
      <div class="message-content" dangerouslySetInnerHTML=${{ __html: renderMarkdown(String(content)) }}></div>
    </div>
  `
}

function AttentionCard({ attention, onResolve }) {
  const [message, setMessage] = useState('')

  if (attention.type === 'permission') {
    const { toolName, input } = attention.payload || {}
    return html`
      <div class="attention-card permission">
        <div class="attention-header">
          <span class="attention-type">Permission Request</span>
          <span class="attention-tool">${toolName}</span>
        </div>
        <pre class="attention-input">${JSON.stringify(input, null, 2)}</pre>
        <div class="attention-actions">
          <button class="deny" onClick=${() => onResolve('deny', 'User denied')}>Deny</button>
          <button class="allow" onClick=${() => onResolve('allow')}>Allow</button>
        </div>
      </div>
    `
  }

  if (attention.type === 'question') {
    return html`
      <div class="attention-card question">
        <div class="attention-header">
          <span class="attention-type">Question</span>
        </div>
        <p class="attention-summary">${attention.summary}</p>
        <textarea
          value=${message}
          onInput=${e => setMessage(e.target.value)}
          placeholder="Your answer..."
        />
        <div class="attention-actions">
          <button onClick=${() => onResolve('allow', message)} disabled=${!message.trim()}>Answer</button>
        </div>
      </div>
    `
  }

  return html`
    <div class="attention-card ${attention.type}">
      <div class="attention-header">
        <span class="attention-type">${attention.type}</span>
      </div>
      <p class="attention-summary">${attention.summary}</p>
      <div class="attention-actions">
        <button onClick=${() => onResolve('allow')}>Acknowledge</button>
      </div>
    </div>
  `
}

render(html`<${App} />`, document.getElementById('app'))
