import { useRef, useEffect } from 'preact/hooks'
import type { SessionWithAttention } from '@/types/session.ts'
import { formatRelativeTime } from '@/utils/time.ts'

interface SessionItemProps {
  session: SessionWithAttention
  isActive: boolean
  isEditing: boolean
  editedName: string
  onClick: () => void
  onStartRename: () => void
  onEditedNameChange: (name: string) => void
  onSaveRename: () => void
  onCancelRename: () => void
}

export function SessionItem({
  session,
  isActive,
  isEditing,
  editedName,
  onClick,
  onStartRename,
  onEditedNameChange,
  onSaveRename,
  onCancelRename
}: SessionItemProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onSaveRename()
    if (e.key === 'Escape') onCancelRename()
  }

  return (
    <div
      class={`session-item ${isActive ? 'active' : ''} ${session.attention.length > 0 ? 'needs-attention' : ''}`}
      onClick={onClick}
    >
      <span class={`session-indicator ${session.process ? 'running' : ''}`} />
      <div class="session-info">
        {isEditing ? (
          <input
            type="text"
            class="session-name-input"
            value={editedName}
            ref={inputRef}
            onInput={(e) => onEditedNameChange((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            onBlur={onSaveRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span class="session-name-row">
            <span class="session-name">{session.name ?? session.id.slice(0, 12)}</span>
            <button
              class="btn-icon edit-btn"
              onClick={(e) => {
                e.stopPropagation()
                onStartRename()
              }}
              title="Rename"
            >
              ✎
            </button>
          </span>
        )}
        <span class="session-time">{formatRelativeTime(session.modified)}</span>
      </div>
      {session.attention.length > 0 && (
        <span class="attention-badge">{session.attention.length}</span>
      )}
    </div>
  )
}
