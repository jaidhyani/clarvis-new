import type { BrowserEntry } from '@/types/api.ts'
import type { ModalEntry, NewSessionFormState } from '@/types/ui.ts'
import type { WorkdirConfigResponse } from '@/types/api.ts'
import { NewSessionModal } from './NewSessionModal.tsx'
import { FileBrowserModal } from './FileBrowserModal.tsx'
import { WorkdirConfigModal } from './WorkdirConfigModal.tsx'

interface ModalContainerProps {
  modalStack: ModalEntry[]
  newSessionForm: NewSessionFormState
  browserPath: string
  browserEntries: BrowserEntry[]
  workdirConfig: WorkdirConfigResponse | null
  onNewSessionFormChange: (updates: Partial<NewSessionFormState>) => void
  onOpenFileBrowser: (initialPath?: string) => void
  onNavigateUp: () => void
  onNavigateTo: (path: string) => void
  onSelectDirectory: (path: string) => void
  onCreateSession: () => void
  onCloseModal: () => void
  onCloseAllModals: () => void
}

export function ModalContainer({
  modalStack,
  newSessionForm,
  browserPath,
  browserEntries,
  workdirConfig,
  onNewSessionFormChange,
  onOpenFileBrowser,
  onNavigateUp,
  onNavigateTo,
  onSelectDirectory,
  onCreateSession,
  onCloseModal,
  onCloseAllModals
}: ModalContainerProps) {
  if (modalStack.length === 0) return null

  return (
    <div class="modal-overlay" onClick={onCloseAllModals}>
      {modalStack.map((modal, index) => {
        const isActive = index === modalStack.length - 1

        return (
          <div
            key={index}
            class={`modal ${modal.id === 'workdirConfig' ? 'modal-wide' : ''} ${modal.id === 'fileBrowser' ? 'file-browser-modal' : ''} ${!isActive ? 'modal-hidden' : ''}`}
            onClick={(e) => e.stopPropagation()}
            style={!isActive ? 'display: none' : undefined}
          >
            {modal.id === 'newSession' && (
              <NewSessionModal
                formState={newSessionForm}
                onFormChange={onNewSessionFormChange}
                onOpenFileBrowser={() => onOpenFileBrowser('')}
                onCreate={onCreateSession}
                onClose={onCloseAllModals}
              />
            )}

            {modal.id === 'fileBrowser' && (
              <FileBrowserModal
                browserPath={browserPath}
                entries={browserEntries}
                onNavigateUp={onNavigateUp}
                onNavigateTo={onNavigateTo}
                onSelect={onSelectDirectory}
                onClose={onCloseModal}
              />
            )}

            {modal.id === 'workdirConfig' && modal.data && (
              <WorkdirConfigModal
                workdir={modal.data}
                config={workdirConfig}
                onOpenFileBrowser={() => onOpenFileBrowser(modal.data + '/.claude')}
                onClose={onCloseAllModals}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
