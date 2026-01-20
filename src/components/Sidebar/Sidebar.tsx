import type { RefObject } from 'preact'
import type { WorkdirGroup } from '@/types/session.ts'
import type { SessionFilter } from '@/types/ui.ts'
import { SearchBox } from './SearchBox.tsx'
import { SessionGroup } from './SessionGroup.tsx'

interface SidebarProps {
  isOpen: boolean
  isRefreshing: boolean
  groups: WorkdirGroup[]
  activeSessionId: string | null
  searchQuery: string
  filter: SessionFilter
  collapsedWorkdirs: Record<string, boolean>
  visibleCounts: Record<string, number>
  defaultVisibleCount: number
  editingSessionId: string | null
  editedName: string
  searchInputRef: RefObject<HTMLInputElement>
  sessionListRef: RefObject<HTMLDivElement>
  searchExpandedWorkdirs: Record<string, boolean>
  onClose: () => void
  onRefresh: () => void
  onCollapseAll: () => void
  onSearchChange: (query: string) => void
  onSearchClear: () => void
  onFilterChange: (filter: SessionFilter) => void
  onNewSession: (workdir?: string) => void
  onOpenConfig: (workdir: string) => void
  onSelectSession: (sessionId: string) => void
  onToggleWorkdirCollapse: (workdir: string) => void
  onShowMore: (workdir: string, count: number) => void
  onShowAll: (workdir: string, total: number) => void
  onStartRename: (sessionId: string, currentName: string) => void
  onEditedNameChange: (name: string) => void
  onSaveRename: () => void
  onCancelRename: () => void
}

export function Sidebar({
  isOpen,
  isRefreshing,
  groups,
  activeSessionId,
  searchQuery,
  filter,
  collapsedWorkdirs,
  visibleCounts,
  defaultVisibleCount,
  editingSessionId,
  editedName,
  searchInputRef,
  sessionListRef,
  searchExpandedWorkdirs,
  onClose,
  onRefresh,
  onCollapseAll,
  onSearchChange,
  onSearchClear,
  onFilterChange,
  onNewSession,
  onOpenConfig,
  onSelectSession,
  onToggleWorkdirCollapse,
  onShowMore,
  onShowAll,
  onStartRename,
  onEditedNameChange,
  onSaveRename,
  onCancelRename
}: SidebarProps) {
  // Determine if workdir is collapsed (search overrides manual collapse)
  const isWorkdirCollapsed = (workdir: string): boolean => {
    if (searchQuery.trim()) {
      return searchExpandedWorkdirs[workdir] ?? true
    }
    return collapsedWorkdirs[workdir] ?? false
  }

  const getVisibleCount = (workdir: string): number => {
    return visibleCounts[workdir] ?? defaultVisibleCount
  }

  const allCollapsed = Object.keys(collapsedWorkdirs).length > 0 &&
    Object.values(collapsedWorkdirs).every(Boolean)

  return (
    <>
      <div class={`sidebar ${isOpen ? 'open' : ''}`}>
        <div class="sidebar-header">
          <div class="sidebar-title-row">
            <h2>Sessions</h2>
            <button
              class={`btn-icon refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh sessions"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <button
              class="btn-icon collapse-all-btn"
              onClick={onCollapseAll}
              title={allCollapsed ? 'Expand all' : 'Collapse all'}
            >
              {allCollapsed ? '▶' : '▼'}
            </button>
          </div>
          <button class="sidebar-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div class="sidebar-controls">
          <SearchBox
            ref={searchInputRef}
            value={searchQuery}
            onChange={onSearchChange}
            onClear={onSearchClear}
          />
          <select
            value={filter}
            onChange={(e) => onFilterChange((e.target as HTMLSelectElement).value as SessionFilter)}
          >
            <option value="all">All Sessions</option>
            <option value="attention">Needs Attention</option>
          </select>
          <button class="btn-primary btn-sm" onClick={() => onNewSession()}>
            + New
          </button>
        </div>

        <div class="session-list" ref={sessionListRef}>
          {groups.map((group) => (
            <SessionGroup
              key={group.workdir}
              group={group}
              activeSessionId={activeSessionId}
              collapsed={isWorkdirCollapsed(group.workdir)}
              visibleCount={getVisibleCount(group.workdir)}
              editingSessionId={editingSessionId}
              editedName={editedName}
              onToggleCollapse={() => onToggleWorkdirCollapse(group.workdir)}
              onSelectSession={onSelectSession}
              onNewSession={() => onNewSession(group.workdir)}
              onOpenConfig={() => onOpenConfig(group.workdir)}
              onShowMore={(count) => onShowMore(group.workdir, count)}
              onShowAll={(total) => onShowAll(group.workdir, total)}
              onStartRename={onStartRename}
              onEditedNameChange={onEditedNameChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      </div>

      {isOpen && <div class="sidebar-overlay" onClick={onClose} />}
    </>
  )
}
