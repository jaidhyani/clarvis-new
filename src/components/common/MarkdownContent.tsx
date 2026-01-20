import { useState, useEffect } from 'preact/hooks'
import { renderMarkdown } from '@/utils/markdown.ts'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className = 'message-content' }: MarkdownContentProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false

    renderMarkdown(content).then((rendered) => {
      if (!cancelled) setHtml(rendered)
    })

    return () => {
      cancelled = true
    }
  }, [content])

  return (
    <div
      class={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
