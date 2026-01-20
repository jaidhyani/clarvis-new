import type { WorkdirConfigResponse } from '@/types/api.ts'

interface WorkdirConfigModalProps {
  workdir: string
  config: WorkdirConfigResponse | null
  onOpenFileBrowser: () => void
  onClose: () => void
}

export function WorkdirConfigModal({
  workdir,
  config,
  onOpenFileBrowser,
  onClose
}: WorkdirConfigModalProps) {
  return (
    <>
      <div class="modal-header">
        <h3>{workdir}</h3>
        <button class="modal-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div class="modal-body">
        <h4>Effective Settings</h4>
        <pre class="config-display">
          {config ? JSON.stringify(config.effective, null, 2) : 'Loading...'}
        </pre>
        <button class="btn-secondary" onClick={onOpenFileBrowser}>
          Browse .claude directory
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  )
}
