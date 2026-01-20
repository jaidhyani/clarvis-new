import { useRef, useEffect } from 'preact/hooks'
import type { Session } from '@/types/session.ts'
import { PERMISSION_MODES } from '@/types/session.ts'

interface SessionHeaderProps {
  session: Session
  showTranscript: boolean
  editingName: boolean
  editedName: string
  onToggleTranscript: () => void
  onStartRename: () => void
  onEditedNameChange: (name: string) => void
  onSaveRename: () => void
  onCancelRename: () => void
  onPermissionModeChange: (sessionId: string, mode: string) => void
  onInterrupt: () => void
  onDelete: () => void
}

export function SessionHeader({
  session,
  showTranscript,
  editingName,
  editedName,
  onToggleTranscript,
  onStartRename,
  onEditedNameChange,
  onSaveRename,
  onCancelRename,
  onPermissionModeChange,
  onInterrupt,
  onDelete
}: SessionHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName) {
      inputRef.current?.focus()
    }
  }, [editingName])

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSaveRename()
    }
    if (e.key === 'Escape') {
      onCancelRename()
    }
  }

  return (
    <>
      <div class="header-session-info">
        {editingName ? (
          <input
            type="text"
            class="header-name-input"
            value={editedName}
            ref={inputRef}
            onInput={(e) => onEditedNameChange((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            onBlur={onSaveRename}
          />
        ) : (
          <h3 class="header-session-name">
            {session.name ?? session.id.slice(0, 16)}
            <button
              class="btn-icon edit-btn"
              onClick={onStartRename}
              title="Rename"
            >
              ✎
            </button>
          </h3>
        )}
        <div class="session-meta">
          <span class="session-workdir">{session.workdir}</span>
          <select
            class="permission-select"
            value={session.permissionMode ?? 'default'}
            onChange={(e) => onPermissionModeChange(session.id, (e.target as HTMLSelectElement).value)}
            title="Permission mode"
          >
            {PERMISSION_MODES.map(mode => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div class="header-actions">
        <button
          class={`btn-icon ${showTranscript ? 'active' : ''}`}
          onClick={onToggleTranscript}
          title="Toggle detailed view (Ctrl+O)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </button>
        {session.process && (
          <button class="btn-secondary" onClick={onInterrupt}>
            Stop
          </button>
        )}
        <button class="btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </>
  )
}
