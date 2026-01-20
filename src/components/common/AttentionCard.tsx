import { useState } from 'preact/hooks'
import type { Attention } from '@/types/session.ts'

interface AttentionCardProps {
  attention: Attention
  onResolve: (behavior: 'allow' | 'deny', message?: string) => void
}

export function AttentionCard({ attention, onResolve }: AttentionCardProps) {
  const [_message, _setMessage] = useState('')

  if (attention.type === 'permission') {
    const toolName = attention.toolName ?? attention.payload?.toolName ?? 'Unknown Tool'
    const input = attention.toolInput ?? attention.payload?.input ?? {}

    return (
      <div class="attention-card permission">
        <div class="attention-header">
          <span class="attention-type">Permission Required</span>
          <span class="attention-tool">{toolName}</span>
        </div>
        <pre class="attention-input">{JSON.stringify(input, null, 2)}</pre>
        <div class="attention-actions">
          <button class="btn-danger" onClick={() => onResolve('deny', 'User denied')}>
            Deny
          </button>
          <button class="btn-success" onClick={() => onResolve('allow')}>
            Allow
          </button>
        </div>
      </div>
    )
  }

  if (attention.type === 'error') {
    return (
      <div class="attention-card error">
        <div class="attention-header">
          <span class="attention-type">Error</span>
        </div>
        <p class="attention-message">{attention.message}</p>
        <div class="attention-actions">
          <button class="btn-secondary" onClick={() => onResolve('allow')}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  if (attention.type === 'completion') {
    return (
      <div class="attention-card completion">
        <div class="attention-header">
          <span class="attention-type">Completed</span>
        </div>
        <p class="attention-message">{attention.message}</p>
        <div class="attention-actions">
          <button class="btn-primary" onClick={() => onResolve('allow')}>
            OK
          </button>
        </div>
      </div>
    )
  }

  return null
}
