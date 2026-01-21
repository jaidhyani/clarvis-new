import type { Attention, Message, ResolvedInteraction, Session } from './session.ts'

/** Directory entry from file browser */
export interface BrowserEntry {
  name: string
  path: string
  type: 'directory' | 'file'
}

/** Response from browse endpoint */
export interface BrowseResponse {
  entries: BrowserEntry[]
  path: string
  isRoot: boolean
}

/** Response from workdir config endpoint */
export interface WorkdirConfigResponse {
  effective: Record<string, unknown>
}

/** Slash command definition */
export interface SlashCommand {
  name: string
  description: string
}

/** Response from POST /sessions */
export interface CreateSessionResponse {
  tempId: string
  name?: string
  config?: Record<string, unknown>
}

/** WebSocket event handlers for subscribe() */
export interface WebSocketHandlers {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  onSessionCreated?: (session: Session, tempId: string) => void
  onSessionUpdated?: (session: Session) => void
  onSessionEnded?: (sessionId: string, reason?: string) => void
  onMessage?: (sessionId: string, message: Message) => void
  onAttention?: (attention: Attention) => void
  onAttentionResolved?: (attentionId: string) => void
  onInteractionResolved?: (sessionId: string, interaction: ResolvedInteraction) => void
}

/** WebSocket event types from server */
export type WebSocketEventType =
  | 'session:created'
  | 'session:updated'
  | 'session:ended'
  | 'session:message'
  | 'attention:requested'
  | 'attention:resolved'
  | 'interaction:resolved'

/** Base WebSocket event structure */
interface BaseWebSocketEvent {
  type: WebSocketEventType
}

/** Session created event - includes tempId for correlation with pending sessions */
export interface SessionCreatedEvent extends BaseWebSocketEvent {
  type: 'session:created'
  session: Session
  tempId: string
}

/** Session updated event */
export interface SessionUpdatedEvent extends BaseWebSocketEvent {
  type: 'session:updated'
  session: Session
}

/** Session ended event */
export interface SessionEndedEvent extends BaseWebSocketEvent {
  type: 'session:ended'
  sessionId: string
  reason?: string
}

/** Session message event */
export interface SessionMessageEvent extends BaseWebSocketEvent {
  type: 'session:message'
  sessionId: string
  message: Message
}

/** Attention requested event */
export interface AttentionRequestedEvent extends BaseWebSocketEvent {
  type: 'attention:requested'
  attention: Attention
}

/** Attention resolved event */
export interface AttentionResolvedEvent extends BaseWebSocketEvent {
  type: 'attention:resolved'
  attentionId: string
}

/** Interaction resolved event */
export interface InteractionResolvedEvent extends BaseWebSocketEvent {
  type: 'interaction:resolved'
  sessionId: string
  interaction: ResolvedInteraction
}

/** Union of all WebSocket events */
export type WebSocketEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionEndedEvent
  | SessionMessageEvent
  | AttentionRequestedEvent
  | AttentionResolvedEvent
  | InteractionResolvedEvent
