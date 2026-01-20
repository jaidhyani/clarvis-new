import { useState, useCallback } from 'preact/hooks'

export interface UseRenameReturn {
  editingId: string | null
  editedName: string
  startRename: (id: string, currentName: string) => void
  setEditedName: (name: string) => void
  cancelRename: () => void
  saveRename: () => Promise<void>
}

/**
 * Reusable hook for inline renaming functionality.
 * Used in both sidebar session list and header session name.
 */
export function useRename(
  onSave: (id: string, name: string) => Promise<void>
): UseRenameReturn {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedName, setEditedName] = useState('')

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id)
    setEditedName(currentName)
  }, [])

  const cancelRename = useCallback(() => {
    setEditingId(null)
    setEditedName('')
  }, [])

  const saveRename = useCallback(async () => {
    if (editingId && editedName.trim()) {
      await onSave(editingId, editedName.trim())
    }
    setEditingId(null)
    setEditedName('')
  }, [editingId, editedName, onSave])

  return {
    editingId,
    editedName,
    startRename,
    setEditedName,
    cancelRename,
    saveRename
  }
}
