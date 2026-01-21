import { useState } from 'preact/hooks'
import type { Message as MessageType, ContentBlock, ToolUseContentBlock, ToolResultContentBlock } from '@/types/session.ts'
import { MarkdownContent } from '@/components/common/MarkdownContent.tsx'

interface MessageProps {
  message: MessageType
}

/** Extract the most relevant parameter to display for a tool */
function getToolDisplayParam(input: Record<string, unknown>): string {
  // Common parameter names in order of preference
  const keyParams = ['command', 'pattern', 'file_path', 'path', 'query', 'url', 'content']

  for (const param of keyParams) {
    if (input[param] !== undefined) {
      const value = String(input[param])
      // Truncate long values
      return value.length > 60 ? value.slice(0, 60) + '...' : value
    }
  }

  // Fall back to first string parameter
  for (const value of Object.values(input)) {
    if (typeof value === 'string' && value.length > 0) {
      const display = value.length > 60 ? value.slice(0, 60) + '...' : value
      return display
    }
  }

  return ''
}

/** Format tool name for display (remove mcp__ prefix, etc.) */
function formatToolName(name: string): string {
  // Remove common prefixes
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    return parts[parts.length - 1] ?? name
  }
  return name
}

/** Extract text content from tool result */
function extractToolResultText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text' && 'text' in b)
    .map(b => b.text)
    .join('\n')
}

/** Get first line or truncated preview of result */
function getResultPreview(content: string | ContentBlock[]): string {
  const text = extractToolResultText(content)
  if (!text) return '(empty)'

  const firstLine = text.split('\n')[0] ?? ''
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine
}

interface ToolUseBlockProps {
  block: ToolUseContentBlock
  result: ToolResultContentBlock | undefined
}

function ToolUseBlock({ block, result }: ToolUseBlockProps) {
  const [expanded, setExpanded] = useState(false)

  const displayName = formatToolName(block.name)
  const displayParam = getToolDisplayParam(block.input)

  return (
    <div class="tool-block">
      <div
        class="tool-header"
        onClick={() => result && setExpanded(!expanded)}
        style={{ cursor: result ? 'pointer' : 'default' }}
      >
        <span class="tool-indicator">●</span>
        <span class="tool-name">{displayName}</span>
        {displayParam && (
          <span class="tool-param">({displayParam})</span>
        )}
        {result && (
          <span class="tool-expand">{expanded ? '▼' : '▶'}</span>
        )}
      </div>
      {result && !expanded && (
        <div class="tool-result-preview">
          └─ {getResultPreview(result.content)}
        </div>
      )}
      {result && expanded && (
        <div class="tool-result-full">
          <pre>{extractToolResultText(result.content)}</pre>
        </div>
      )}
    </div>
  )
}

export function Message({ message }: MessageProps) {
  if (!message) return null

  const isInteraction = message.type === 'interaction' || message.type === 'user_interaction'
  const isThinking = message.type === 'thinking' || message.thinking

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

  if (isThinking) {
    return (
      <div class="message thinking">
        <div class="thinking-label">Thinking</div>
        <MarkdownContent content={String(message.thinking ?? message.content)} />
      </div>
    )
  }

  const role = message.role ?? 'assistant'
  const roleLabel = role === 'user' ? 'You' : 'Claude'
  const content = message.content

  // Handle simple string content
  if (typeof content === 'string') {
    if (!content) return null
    return (
      <div class={`message ${role}`}>
        <div class="message-role">{roleLabel}</div>
        <MarkdownContent content={content} />
      </div>
    )
  }

  // Handle array of content blocks
  if (!Array.isArray(content) || content.length === 0) return null

  // Build a map of tool_use_id -> tool_result for pairing
  const resultMap = new Map<string, ToolResultContentBlock>()
  for (const block of content) {
    if (block.type === 'tool_result') {
      resultMap.set(block.tool_use_id, block)
    }
  }

  // Track which tool_results we've rendered (to avoid duplicates)
  const renderedResults = new Set<string>()

  const renderedBlocks = content.map((block, i) => {
    if (block.type === 'text') {
      if (!block.text) return null
      return <MarkdownContent key={i} content={block.text} />
    }

    if (block.type === 'tool_use') {
      const result = resultMap.get(block.id)
      if (result) {
        renderedResults.add(block.id)
      }
      return <ToolUseBlock key={i} block={block} result={result} />
    }

    if (block.type === 'tool_result') {
      // Skip if already rendered with its tool_use
      if (renderedResults.has(block.tool_use_id)) return null

      // Orphan result (tool_use in different message) - render standalone
      return (
        <div key={i} class="tool-block tool-result-orphan">
          <div class="tool-result-preview">
            └─ {getResultPreview(block.content)}
          </div>
        </div>
      )
    }

    return null
  })

  // Check if we have any visible content
  const hasVisibleContent = renderedBlocks.some(b => b !== null)
  if (!hasVisibleContent) return null

  return (
    <div class={`message ${role}`}>
      <div class="message-role">{roleLabel}</div>
      <div class="message-content">
        {renderedBlocks}
      </div>
    </div>
  )
}
