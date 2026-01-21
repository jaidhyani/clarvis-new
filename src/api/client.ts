import type {
  Attention,
  AttentionResolution,
  BrowseResponse,
  CreateSessionResponse,
  Message,
  Session,
  SessionConfig,
  WebSocketEvent,
  WebSocketHandlers,
  WorkdirConfigResponse
} from '@/types/index.ts'

/** API client for Claudekeeper backend via Clarvis proxy */
export class ClaudekeeperClient {
  private token: string
  private ws: WebSocket | null = null
  private handlers: WebSocketHandlers = {}

  constructor(token: string) {
    this.token = token
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
      throw new Error(error.error ?? 'Request failed')
    }

    return res.json() as Promise<T>
  }

  async listSessions(): Promise<Session[]> {
    return this.fetch<Session[]>('/sessions')
  }

  async getSession(id: string): Promise<Session & { messages?: Message[] }> {
    return this.fetch<Session & { messages?: Message[] }>(`/sessions/${id}`)
  }

  async createSession(
    workdir: string,
    prompt?: string,
    name?: string,
    config?: SessionConfig
  ): Promise<CreateSessionResponse> {
    return this.fetch<CreateSessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ workdir, prompt, name, config })
    })
  }

  async deleteSession(id: string): Promise<void> {
    await this.fetch<void>(`/sessions/${id}`, { method: 'DELETE' })
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    await this.fetch<void>(`/sessions/${sessionId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message })
    })
  }

  async interruptSession(sessionId: string): Promise<void> {
    await this.fetch<void>(`/sessions/${sessionId}/interrupt`, { method: 'POST' })
  }

  async getAttention(): Promise<Attention[]> {
    return this.fetch<Attention[]>('/attention')
  }

  async resolveAttention(attentionId: string, resolution: AttentionResolution): Promise<void> {
    await this.fetch<void>(`/attention/${attentionId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution)
    })
  }

  async browse(path: string = ''): Promise<BrowseResponse> {
    const url = path ? `/browse?path=${encodeURIComponent(path)}` : '/browse'
    return this.fetch<BrowseResponse>(url)
  }

  async getWorkdirConfig(workdir: string): Promise<WorkdirConfigResponse> {
    return this.fetch<WorkdirConfigResponse>(`/workdir/config?path=${encodeURIComponent(workdir)}`)
  }

  async renameSession(id: string, name: string): Promise<void> {
    await this.fetch<void>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    })
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    await this.fetch<void>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  }

  /** Subscribe to real-time events via WebSocket. Returns an unsubscribe function. */
  subscribe(handlers: WebSocketHandlers): () => void {
    this.handlers = handlers

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${location.host}/ws?token=${this.token}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ type: 'subscribe' }))
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
        const data = JSON.parse(event.data as string) as WebSocketEvent
        this.handleEvent(data)
      } catch {
        // Ignore malformed messages
      }
    }

    return () => {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    }
  }

  private handleEvent(event: WebSocketEvent): void {
    const h = this.handlers

    switch (event.type) {
      case 'session:created':
        h.onSessionCreated?.(event.session, event.tempId)
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

  /** Close WebSocket connection */
  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}
