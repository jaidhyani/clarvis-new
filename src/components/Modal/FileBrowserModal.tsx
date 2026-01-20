import type { BrowserEntry } from '@/types/api.ts'

interface FileBrowserModalProps {
  browserPath: string
  entries: BrowserEntry[]
  onNavigateUp: () => void
  onNavigateTo: (path: string) => void
  onSelect: (path: string) => void
  onClose: () => void
}

export function FileBrowserModal({
  browserPath,
  entries,
  onNavigateUp,
  onNavigateTo,
  onSelect,
  onClose
}: FileBrowserModalProps) {
  return (
    <>
      <div class="modal-header">
        <h3>Select Directory</h3>
        <button class="modal-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div class="browser-path">
        {browserPath ? (
          <>
            <button class="btn-icon" onClick={onNavigateUp}>
              ←
            </button>
            <span>{browserPath}</span>
          </>
        ) : (
          <span class="browser-root-label">Select a project root:</span>
        )}
      </div>
      <div class="browser-list">
        {entries.length === 0 ? (
          <div class="browser-empty">No directories available</div>
        ) : (
          entries.map((entry) => (
            <div
              class="browser-item"
              key={entry.path}
              onClick={() => onNavigateTo(entry.path)}
              onDblClick={() => onSelect(entry.path)}
            >
              <span class="browser-icon">📁</span>
              <span class="browser-name">{entry.name}</span>
            </div>
          ))
        )}
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          class="btn-primary"
          onClick={() => onSelect(browserPath)}
          disabled={!browserPath}
        >
          Select This Directory
        </button>
      </div>
    </>
  )
}
