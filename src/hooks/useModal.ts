import { useState, useCallback, useMemo } from 'preact/hooks'
import type { ModalEntry, ModalType } from '@/types/ui.ts'
import { MODAL_CHILDREN } from '@/types/ui.ts'

export interface UseModalReturn {
  modalStack: ModalEntry[]
  activeModal: ModalType | null
  modalData: string | null
  openModal: (modalId: ModalType, data?: string | null) => void
  closeModal: () => void
  closeAllModals: () => void
}

/**
 * Manages modal stack with parent-child relationships.
 * Child modals (like fileBrowser from newSession) can be pushed onto the stack.
 * Closing a child modal returns to the parent.
 */
export function useModal(): UseModalReturn {
  const [modalStack, setModalStack] = useState<ModalEntry[]>([])

  const activeModal = useMemo(
    () => modalStack.length > 0 ? modalStack[modalStack.length - 1]?.id ?? null : null,
    [modalStack]
  )

  const modalData = useMemo(
    () => modalStack.length > 0 ? modalStack[modalStack.length - 1]?.data ?? null : null,
    [modalStack]
  )

  const openModal = useCallback((modalId: ModalType, data: string | null = null) => {
    setModalStack(prev => {
      // If this is a child modal of the current modal, push onto stack
      if (prev.length > 0) {
        const currentModal = prev[prev.length - 1]?.id
        if (currentModal) {
          const allowedChildren = MODAL_CHILDREN[currentModal] ?? []
          if (allowedChildren.includes(modalId)) {
            return [...prev, { id: modalId, data }]
          }
        }
      }
      // Otherwise, replace the entire stack
      return [{ id: modalId, data }]
    })
  }, [])

  const closeModal = useCallback(() => {
    setModalStack(prev => {
      if (prev.length <= 1) return []
      // Pop the top modal, return to parent
      return prev.slice(0, -1)
    })
  }, [])

  const closeAllModals = useCallback(() => {
    setModalStack([])
  }, [])

  return {
    modalStack,
    activeModal,
    modalData,
    openModal,
    closeModal,
    closeAllModals
  }
}
