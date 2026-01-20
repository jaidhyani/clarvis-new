import type { ContentBlock } from '@/types/session.ts'

/**
 * Extracts displayable text from message content.
 * Handles string content, arrays of content blocks, and objects with text property.
 */
export function extractTextContent(content: string | ContentBlock[] | { text?: string } | undefined | null): string {
  if (!content) return ''

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text' && 'text' in b)
      .map(b => b.text)
      .join('\n')
  }

  if ('text' in content && content.text) {
    return content.text
  }

  return ''
}

/** Checks if message content contains tool_use blocks */
export function hasToolUse(content: string | ContentBlock[] | undefined): boolean {
  if (!Array.isArray(content)) return false
  return content.some(b => b.type === 'tool_use')
}

/** Gets the last path segment of a workdir path */
export function getWorkdirName(workdir: string): string {
  const parts = workdir.split('/')
  return parts[parts.length - 1] ?? workdir
}
