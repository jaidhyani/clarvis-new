import { PERMISSION_MODES } from '@/types/session.ts'
import type { NewSessionFormState } from '@/types/ui.ts'

interface NewSessionModalProps {
  formState: NewSessionFormState
  onFormChange: (updates: Partial<NewSessionFormState>) => void
  onOpenFileBrowser: () => void
  onCreate: () => void
  onClose: () => void
}

export function NewSessionModal({
  formState,
  onFormChange,
  onOpenFileBrowser,
  onCreate,
  onClose
}: NewSessionModalProps) {
  return (
    <>
      <div class="modal-header">
        <h3>New Session</h3>
        <button class="modal-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Name (optional)</label>
          <input
            type="text"
            value={formState.name}
            onInput={(e) => onFormChange({ name: (e.target as HTMLInputElement).value })}
            placeholder="My session"
          />
        </div>
        <div class="form-group">
          <label>Workdir *</label>
          <div class="input-with-button">
            <input
              type="text"
              value={formState.workdir}
              onInput={(e) => onFormChange({ workdir: (e.target as HTMLInputElement).value })}
              placeholder="/home/user/project"
            />
            <button onClick={onOpenFileBrowser}>📁</button>
          </div>
        </div>
        <div class="form-group">
          <label>Initial prompt (optional)</label>
          <textarea
            value={formState.prompt}
            onInput={(e) => onFormChange({ prompt: (e.target as HTMLTextAreaElement).value })}
            placeholder="What would you like to work on?"
            rows={3}
          />
        </div>
        <div class="form-group">
          <label>Permissions</label>
          <select
            value={formState.permissionMode}
            onChange={(e) => onFormChange({ permissionMode: (e.target as HTMLSelectElement).value })}
          >
            {PERMISSION_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.description}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button class="btn-primary" onClick={onCreate} disabled={!formState.workdir}>
          Create
        </button>
      </div>
    </>
  )
}
