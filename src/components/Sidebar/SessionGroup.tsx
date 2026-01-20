import type { WorkdirGroup } from '@/types/session.ts'
import { SessionItem } from './SessionItem.tsx'
import { getWorkdirName } from '@/utils/content.ts'

interface SessionGroupProps {
  group: WorkdirGroup
  activeSessionId: string | null
  collapsed: boolean
  visibleCount: number
  editingSessionId: string | null
  editedName: string
  onToggleCollapse: () => void
  onSelectSession: (sessionId: string) => void
  onNewSession: (workdir: string) => void
  onOpenConfig: (workdir: string) => void
  onShowMore: (count: number) => void
  onShowAll: (total: number) => void
  onStartRename: (sessionId: string, currentName: string) => void
  onEditedNameChange: (name: string) => void
  onSaveRename: () => void
  onCancelRename: () => void
}

export function SessionGroup({
  group,
  activeSessionId,
  collapsed,
  visibleCount,
  editingSessionId,
  editedName,
  onToggleCollapse,
  onSelectSession,
  onNewSession,
  onOpenConfig,
  onShowMore,
  onShowAll,
  onStartRename,
  onEditedNameChange,
  onSaveRename,
  onCancelRename
}: SessionGroupProps) {
  const visibleSessions = group.sessions.slice(0, visibleCount)
  const hiddenCount = group.sessions.length - visibleCount
  const hasMore = hiddenCount > 0

  return (
    <div class={`session-group ${collapsed ? 'collapsed' : ''}`}>
      <div class="group-header" onClick={onToggleCollapse}>
        <span class="collapse-icon">{collapsed ? '▶' : '▼'}</span>
        <span class="workdir-name" title={group.workdir}>
          {getWorkdirName(group.workdir)}
        </span>
        <span class="session-count">({group.sessions.length})</span>
        <button
          class="btn-icon new-session-btn"
          onClick={(e) => {
            e.stopPropagation()
            onNewSession(group.workdir)
          }}
          title="New session in this directory"
        >
          +
        </button>
        <button
          class="btn-icon config-btn"
          onClick={(e) => {
            e.stopPropagation()
            onOpenConfig(group.workdir)
          }}
          title="View config"
        >
          ⚙
        </button>
      </div>

      {!collapsed && (
        <div class="group-sessions">
          {visibleSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              isEditing={editingSessionId === session.id}
              editedName={editedName}
              onClick={() => onSelectSession(session.id)}
              onStartRename={() => onStartRename(session.id, session.name ?? '')}
              onEditedNameChange={onEditedNameChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
            />
          ))}

          {hasMore && (
            <div class="session-overflow">
              <button onClick={() => onShowMore(5)}>
                Show {Math.min(5, hiddenCount)} more
              </button>
              {hiddenCount > 5 && (
                <button onClick={() => onShowAll(group.sessions.length)}>
                  Show all ({group.sessions.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
