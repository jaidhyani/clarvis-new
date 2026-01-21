import { useRef, useEffect, useLayoutEffect, useState } from 'preact/hooks'
import type { Attention, Message as MessageType, ResolvedInteraction } from '@/types/session.ts'
import { Message } from './Message.tsx'
import { AttentionCard } from '../common/AttentionCard.tsx'
import { formatRelativeTime } from '@/utils/time.ts'

interface MessageListProps {
  messages: MessageType[]
  interactions: ResolvedInteraction[]
  attention: Attention[]
  sessionStatus: 'idle' | 'running'
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
  sessionStatus,
  onResolveAttention
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const prevMessageCount = useRef(0)

  // Instant scroll to bottom on initial load (before paint)
  useLayoutEffect(() => {
    if (isInitialLoad && messages.length > 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setIsInitialLoad(false)
      prevMessageCount.current = messages.length
    }
  }, [messages, isInitialLoad])

  // Smooth scroll for new messages during session
  useEffect(() => {
    if (!isInitialLoad && messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = messages.length
  }, [messages, isInitialLoad])

  // Reset initial load state when switching sessions (messages array changes entirely)
  useEffect(() => {
    setIsInitialLoad(true)
  }, [messages.length === 0])

  const mergedItems = getMergedTranscript(messages, interactions)
  const isWorking = sessionStatus === 'running'

  return (
    <div class="messages" ref={containerRef}>
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

      {isWorking && (
        <div class="message assistant working">
          <div class="message-role">Claude</div>
          <div class="working-indicator">
            <span class="working-dot"></span>
            <span class="working-text">Working...</span>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
