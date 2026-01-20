/** Permission modes for Claude Code sessions */
export type PermissionMode = 'default' | 'plan' | 'dangerously-skip-permissions'

export interface PermissionModeConfig {
  value: PermissionMode
  label: string
  description: string
  dangerous?: boolean
}

export const PERMISSION_MODES: PermissionModeConfig[] = [
  { value: 'default', label: 'Default', description: 'Ask before dangerous actions' },
  { value: 'plan', label: 'Plan Mode', description: 'Planning only, no code execution' },
  { value: 'dangerously-skip-permissions', label: 'Skip Permissions', description: 'Skip all permission checks (dangerous)', dangerous: true }
]

/** Session configuration passed when creating a session */
export interface SessionConfig {
  permissionMode?: PermissionMode
}

/** A Claude Code session */
export interface Session {
  id: string
  workdir: string
  name?: string
  status: 'idle' | 'running'
  config: SessionConfig
  created: string
  modified: string
  permissionMode: PermissionMode
  process?: unknown
  /** For pending (optimistic) sessions before server confirms */
  _pendingFor?: string
}

/** Extended session with computed attention data for display */
export interface SessionWithAttention extends Session {
  attention: Attention[]
}

/** A text block in message content */
export interface TextContentBlock {
  type: 'text'
  text: string
}

/** A tool use block in message content */
export interface ToolUseContentBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/** A tool result block in message content */
export interface ToolResultContentBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlock[]
}

/** Content blocks that can appear in messages */
export type ContentBlock = TextContentBlock | ToolUseContentBlock | ToolResultContentBlock

/** A message in a session */
export interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
  timestamp?: string
  /** For optimistic messages before server confirms */
  optimistic?: boolean
  /** For thinking messages */
  type?: 'thinking' | 'interaction' | 'user_interaction'
  thinking?: string
  /** For interaction messages */
  question?: string
  summary?: string
  answer?: string
}

/** Attention types */
export type AttentionType = 'permission' | 'error' | 'completion'

/** An attention item requiring user action */
export interface Attention {
  id: string
  sessionId: string
  type: AttentionType
  message?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  payload?: {
    toolName?: string
    input?: Record<string, unknown>
  }
}

/** Resolution for attention items */
export interface AttentionResolution {
  behavior: 'allow' | 'deny'
  message?: string
}

/** A resolved interaction for display in transcript */
export interface ResolvedInteraction {
  type: string
  toolName?: string
  toolInput?: Record<string, unknown>
  resolution: 'allow' | 'deny'
  message?: string
  resolvedAt: string
}

/** Session grouped by workdir for sidebar display */
export interface WorkdirGroup {
  name: string
  workdir: string
  sessions: SessionWithAttention[]
}
