// Claudekeeper API client

export class ClaudekeeperClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
    this.ws = null
    this.handlers = {}
  }

  async fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
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

  async createSession(workdir, prompt, config) {
    return this.fetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ workdir, prompt, config })
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

  subscribe(handlers) {
    this.handlers = handlers

    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + `?token=${this.token}`
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
    }
  }
}
