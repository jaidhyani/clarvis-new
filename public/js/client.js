// Claudekeeper API client (via Clarvis proxy)

export class ClaudekeeperClient {
  constructor(token) {
    this.token = token
    this.ws = null
    this.handlers = {}
  }

  async fetch(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(error.error || 'Request failed')
    }
    return res.json()
  }

  async listSessions() {
    return this.fetch('/sessions')
  }

  async getSession(id) {
    return this.fetch(`/sessions/${id}`)
  }

  async createSession(workdir, prompt, name, config) {
    return this.fetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ workdir, prompt, name, config })
    })
  }

  async deleteSession(id) {
    return this.fetch(`/sessions/${id}`, { method: 'DELETE' })
  }

  async sendMessage(sessionId, message) {
    return this.fetch(`/sessions/${sessionId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message })
    })
  }

  async interruptSession(sessionId) {
    return this.fetch(`/sessions/${sessionId}/interrupt`, { method: 'POST' })
  }

  async getAttention() {
    return this.fetch('/attention')
  }

  async resolveAttention(attentionId, resolution) {
    return this.fetch(`/attention/${attentionId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution)
    })
  }

  async getHealth() {
    return this.fetch('/health')
  }

  async browse(path = '') {
    const url = path ? `/browse?path=${encodeURIComponent(path)}` : '/browse'
    return this.fetch(url)
  }

  async browseWorkdir(path) {
    return this.fetch(`/workdir/browse?path=${encodeURIComponent(path)}`)
  }

  async readWorkdirFile(path) {
    return this.fetch(`/workdir/file?path=${encodeURIComponent(path)}`)
  }

  async getWorkdirConfig(workdir) {
    return this.fetch(`/workdir/config?path=${encodeURIComponent(workdir)}`)
  }

  async renameSession(id, name) {
    return this.fetch(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    })
  }

  async updateSession(id, updates) {
    return this.fetch(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  }

  async getSlashCommands() {
    return this.fetch('/slash-commands')
  }

  subscribe(handlers) {
    this.handlers = handlers

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${location.host}/ws?token=${this.token}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'subscribe' }))
      handlers.onConnect?.()
    }

    this.ws.onclose = () => {
      handlers.onDisconnect?.()
    }

    this.ws.onerror = (err) => {
      handlers.onError?.(err)
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleEvent(data)
      } catch {}
    }

    return () => {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    }
  }

  handleEvent(event) {
    const h = this.handlers
    switch (event.type) {
      case 'session:created':
        h.onSessionCreated?.(event.session)
        break
      case 'session:updated':
        h.onSessionUpdated?.(event.session)
        break
      case 'session:ended':
        h.onSessionEnded?.(event.sessionId, event.reason)
        break
      case 'session:message':
        h.onMessage?.(event.sessionId, event.message)
        break
      case 'attention:requested':
        h.onAttention?.(event.attention)
        break
      case 'attention:resolved':
        h.onAttentionResolved?.(event.attentionId)
        break
      case 'interaction:resolved':
        h.onInteractionResolved?.(event.sessionId, event.interaction)
        break
    }
  }
}
