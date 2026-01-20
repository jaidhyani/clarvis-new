import { useRef, useEffect } from 'preact/hooks'
import type { SlashCommand } from '@/types/api.ts'

interface MessageInputProps {
  inputText: string
  showSlashMenu: boolean
  filteredCommands: SlashCommand[]
  selectedSlashIndex: number
  disabled: boolean
  onInputChange: (value: string) => void
  onSend: () => void
  onSlashTrigger: () => void
  onSlashSelect: (cmd: SlashCommand) => void
  onArrowDown: () => void
  onArrowUp: () => void
  onCloseSlashMenu: () => void
}

export function MessageInput({
  inputText,
  showSlashMenu,
  filteredCommands,
  selectedSlashIndex,
  disabled,
  onInputChange,
  onSend,
  onSlashTrigger,
  onSlashSelect,
  onArrowDown,
  onArrowUp,
  onCloseSlashMenu
}: MessageInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (showSlashMenu && slashMenuRef.current) {
      const selected = slashMenuRef.current.querySelector('.selected')
      selected?.scrollIntoView({ block: 'nearest' })
    }
  }, [showSlashMenu, selectedSlashIndex])

  const handleInputChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement
    onInputChange(target.value)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        onArrowDown()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        onArrowUp()
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        const cmd = filteredCommands[selectedSlashIndex]
        if (cmd) onSlashSelect(cmd)
        return
      }
      if (e.key === 'Escape') {
        onCloseSlashMenu()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div class="input-container">
      {showSlashMenu && filteredCommands.length > 0 && (
        <div class="slash-menu" ref={slashMenuRef}>
          {filteredCommands.map((cmd, i) => (
            <div
              class={`slash-item ${i === selectedSlashIndex ? 'selected' : ''}`}
              onClick={() => onSlashSelect(cmd)}
              key={cmd.name}
            >
              <span class="slash-name">/{cmd.name}</span>
              <span class="slash-desc">{cmd.description}</span>
            </div>
          ))}
        </div>
      )}
      <div class="input-area">
        <button
          class="slash-trigger"
          onClick={() => {
            onInputChange('/')
            onSlashTrigger()
            inputRef.current?.focus()
          }}
          title="Slash commands"
        >
          /
        </button>
        <textarea
          ref={inputRef}
          value={inputText}
          onInput={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message or / for commands..."
          rows={1}
        />
        <button class="btn-send" onClick={onSend} disabled={disabled || !inputText.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22,2 15,22 11,13 2,9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
