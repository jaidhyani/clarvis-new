import { useState, useMemo, useCallback } from 'preact/hooks'
import { SLASH_COMMANDS } from '@/utils/constants.ts'
import type { SlashCommand } from '@/types/api.ts'

export interface UseSlashCommandsReturn {
  showSlashMenu: boolean
  slashFilter: string
  selectedSlashIndex: number
  filteredCommands: SlashCommand[]
  setSlashFilter: (filter: string) => void
  setSelectedSlashIndex: (index: number) => void
  openSlashMenu: () => void
  closeSlashMenu: () => void
  selectCommand: (cmd: SlashCommand) => string
  handleArrowDown: () => void
  handleArrowUp: () => void
}

/**
 * Manages slash command menu state and filtering.
 */
export function useSlashCommands(): UseSlashCommandsReturn {
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS

    const lower = slashFilter.toLowerCase()
    return SLASH_COMMANDS.filter(cmd =>
      cmd.name.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower)
    )
  }, [slashFilter])

  const openSlashMenu = useCallback(() => {
    setShowSlashMenu(true)
  }, [])

  const closeSlashMenu = useCallback(() => {
    setShowSlashMenu(false)
    setSlashFilter('')
    setSelectedSlashIndex(0)
  }, [])

  const selectCommand = useCallback((cmd: SlashCommand): string => {
    setShowSlashMenu(false)
    setSlashFilter('')
    return '/' + cmd.name + ' '
  }, [])

  const handleArrowDown = useCallback(() => {
    setSelectedSlashIndex(i => Math.min(i + 1, filteredCommands.length - 1))
  }, [filteredCommands.length])

  const handleArrowUp = useCallback(() => {
    setSelectedSlashIndex(i => Math.max(i - 1, 0))
  }, [])

  return {
    showSlashMenu,
    slashFilter,
    selectedSlashIndex,
    filteredCommands,
    setSlashFilter,
    setSelectedSlashIndex,
    openSlashMenu,
    closeSlashMenu,
    selectCommand,
    handleArrowDown,
    handleArrowUp
  }
}
