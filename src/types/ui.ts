/** Modal types in the application */
export type ModalType = 'newSession' | 'fileBrowser' | 'workdirConfig'

/** Modal stack entry */
export interface ModalEntry {
  id: ModalType
  data: string | null
}

/** Modal parent-child relationships for stacking */
export const MODAL_CHILDREN: Record<ModalType, ModalType[]> = {
  newSession: ['fileBrowser'],
  workdirConfig: ['fileBrowser'],
  fileBrowser: []
}

/** Session filter options */
export type SessionFilter = 'all' | 'attention'

/** New session form state */
export interface NewSessionFormState {
  workdir: string
  prompt: string
  name: string
  permissionMode: string
}

/** Pending permission change requiring confirmation */
export interface PendingPermissionChange {
  sessionId: string
  mode: string
}

/** localStorage keys used by the app */
export const STORAGE_KEYS = {
  TOKEN: 'clarvis_token',
  ACTIVE_SESSION: 'clarvis_activeSession',
  COLLAPSED_WORKDIRS: 'clarvis_collapsedWorkdirs',
  VISIBLE_COUNTS: 'clarvis_visibleCounts',
  MAX_VISIBLE: 'clarvis_maxVisible'
} as const
