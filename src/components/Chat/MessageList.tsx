import { useRef, useEffect } from 'preact/hooks'
import type { Attention, Message as MessageType, ResolvedInteraction } from '@/types/session.ts'
import { Message } from './Message.tsx'
import { AttentionCard } from '../common/AttentionCard.tsx'
import { formatRelativeTime } from '@/utils/time.ts'

interface MessageListProps {
  messages: MessageType[]
  interactions: ResolvedInteraction[]
  attention: Attention[]
  showTranscript: boolean
  awaitingResponse: boolean
  onResolveAttention: (attentionId: string, behavior: 'allow' | 'deny', message?: string) => void
}

type MergedItem = (MessageType & { itemType: 'message' }) | (ResolvedInteraction & { itemType: 'interaction' })

function getMergedTranscript(
  messages: MessageType[],
  interactions: ResolvedInteraction[]
): MergedItem[] {
  const items: MergedItem[] = [
    ...messages.map(m => ({ ...m, itemType: 'message' as const })),
    ...interactions.map(i => ({ ...i, itemType: 'interaction' as const }))
  ]

  return items.sort((a, b) => {
    const aTime = a.itemType === 'message' ? a.timestamp : a.resolvedAt
    const bTime = b.itemType === 'message' ? b.timestamp : b.resolvedAt
    return new Date(aTime ?? 0).getTime() - new Date(bTime ?? 0).getTime()
  })
}

export function MessageList({
  messages,
  interactions,
  attention,
  showTranscript,
  awaitingResponse,
  onResolveAttention
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const mergedItems = getMergedTranscript(messages, interactions)

  return (
    <div class="messages">
      {mergedItems.map((item, i) => {
        if (item.itemType === 'interaction') {
          return (
            <div
              class={`message interaction-resolved ${item.resolution === 'allow' ? 'allowed' : 'denied'}`}
              key={`int-${i}`}
            >
              <span class="interaction-icon">{item.resolution === 'allow' ? '✓' : '✕'}</span>
              <div class="interaction-content">
                <span class="interaction-action">
                  {item.resolution === 'allow' ? 'Allowed' : 'Denied'} {item.toolName ?? item.type}
                  {item.toolInput?.file_path ? ` to ${String(item.toolInput.file_path)}` : ''}
                </span>
                {item.message && (
                  <span class="interaction-message">"{item.message}"</span>
                )}
                <span class="interaction-time">{formatRelativeTime(item.resolvedAt)}</span>
              </div>
            </div>
          )
        }
        return (
          <Message
            key={`msg-${i}`}
            message={item}
            showTranscript={showTranscript}
          />
        )
      })}

      {attention.map(a => (
        <AttentionCard
          key={a.id}
          attention={a}
          onResolve={(behavior, message) => onResolveAttention(a.id, behavior, message)}
        />
      ))}

      {awaitingResponse && (
        <div class="message assistant loading">
          <div class="message-role">Claude</div>
          <div class="loading-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
