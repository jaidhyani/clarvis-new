import type { Message as MessageType, ContentBlock, ToolUseContentBlock } from '@/types/session.ts'
import { extractTextContent, hasToolUse } from '@/utils/content.ts'
import { MarkdownContent } from '@/components/common/MarkdownContent.tsx'

interface MessageProps {
  message: MessageType
  showTranscript: boolean
}

export function Message({ message, showTranscript }: MessageProps) {
  if (!message) return null

  const isInteraction = message.type === 'interaction' || message.type === 'user_interaction'
  const isThinking = message.type === 'thinking' || message.thinking

  // Check for tool_use blocks in content array
  const msgHasToolUse = hasToolUse(message.content as ContentBlock[] | undefined)

  if (!showTranscript && (msgHasToolUse || isThinking)) {
    // Still show text content if present
    const textContent = extractTextContent(message.content)
    if (!textContent) return null

    const role = message.role ?? 'assistant'
    const roleLabel = role === 'user' ? 'You' : 'Claude'

    return (
      <div class={`message ${role}`}>
        <div class="message-role">{roleLabel}</div>
        <MarkdownContent content={textContent} />
      </div>
    )
  }

  if (isInteraction) {
    return (
      <div class="message interaction">
        <div class="interaction-label">User Interaction</div>
        <div class="interaction-question">{message.question ?? message.summary}</div>
        {message.answer && (
          <div class="interaction-answer">
            <strong>Answer:</strong> {message.answer}
          </div>
        )}
      </div>
    )
  }

  if (isThinking && showTranscript) {
    return (
      <div class="message thinking">
        <div class="thinking-label">Thinking</div>
        <MarkdownContent content={String(message.thinking ?? message.content)} />
      </div>
    )
  }

  const role = message.role ?? 'assistant'
  const roleLabel = role === 'user' ? 'You' : 'Claude'
  const content = extractTextContent(message.content)

  if (!content) return null

  const toolUseBlocks = Array.isArray(message.content)
    ? message.content.filter((b): b is ToolUseContentBlock => b.type === 'tool_use')
    : []

  return (
    <div class={`message ${role}`}>
      <div class="message-role">{roleLabel}</div>
      <MarkdownContent content={content} />
      {showTranscript && toolUseBlocks.length > 0 && (
        <div class="tool-uses">
          {toolUseBlocks.map((tool, i) => (
            <div class="tool-use-inline" key={i}>
              <span class="tool-name">{tool.name}</span>
              <pre class="tool-input">{JSON.stringify(tool.input, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
