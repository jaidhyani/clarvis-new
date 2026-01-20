import { useState, useRef, useEffect } from 'preact/hooks'
import type { WorkdirConfigResponse } from '@/types/api.ts'
import type { NewSessionFormState, PendingPermissionChange, SessionFilter } from '@/types/ui.ts'
import { STORAGE_KEYS } from '@/types/ui.ts'
import { DEFAULT_VISIBLE_SESSIONS, MAX_SESSION_NAME_LENGTH } from '@/utils/constants.ts'
import { useSession, useModal, useFileBrowser, useSlashCommands, useSessionGroups, useRename, usePullToRefresh, useStorage } from '@/hooks/index.ts'
import { LoginView, Sidebar, MessageList, MessageInput, SessionHeader, ModalContainer, ConfirmPermissionModal } from '@/components/index.ts'

export function App() {
  // Token from localStorage
  const [token, setToken] = useStorage(STORAGE_KEYS.TOKEN, '')

  // Main session hook - handles WebSocket, sessions, messages, attention
  const session = useSession(token)

  // Modal stack management
  const modal = useModal()

  // File browser for selecting workdir
  const fileBrowser = useFileBrowser(session.clientRef.current)

  // Slash commands for message input
  const slashCommands = useSlashCommands()

  // Session groups with search and filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<SessionFilter>('all')
  const sessionGroups = useSessionGroups(
    session.sessions,
    session.attention,
    searchQuery,
    filter
  )

  // Sidebar rename (uses hook for shared logic)
  const sidebarRename = useRename(async (id, name) => {
    await session.renameSession(id, name)
  })

  // Header rename (uses hook for shared logic)
  const headerRename = useRename(async (id, name) => {
    await session.renameSession(id, name)
  })

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [inputText, setInputText] = useState('')

  // Sidebar collapse state (persisted)
  const [collapsedWorkdirs, setCollapsedWorkdirs] = useStorage<Record<string, boolean>>(
    STORAGE_KEYS.COLLAPSED_WORKDIRS,
    {}
  )
  const [visibleCounts, setVisibleCounts] = useStorage<Record<string, number>>(
    STORAGE_KEYS.VISIBLE_COUNTS,
    {}
  )

  // New session form state
  const [newSessionForm, setNewSessionForm] = useState<NewSessionFormState>({
    workdir: '',
    prompt: '',
    name: '',
    permissionMode: 'default'
  })

  // Permission mode change confirmation
  const [pendingPermissionChange, setPendingPermissionChange] = useState<PendingPermissionChange | null>(null)

  // Workdir config (fetched when modal opens)
  const [workdirConfig, setWorkdirConfig] = useState<WorkdirConfigResponse | null>(null)

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sessionListRef = usePullToRefresh(session.refreshSessions, session.connected && !session.isRefreshing)

  // Fetch workdir config when modal opens
  useEffect(() => {
    if (modal.activeModal === 'workdirConfig' && modal.modalData && session.clientRef.current) {
      session.clientRef.current.getWorkdirConfig(modal.modalData)
        .then(data => setWorkdirConfig(data))
        .catch(() => setWorkdirConfig({ effective: {} }))
    } else if (modal.activeModal !== 'workdirConfig') {
      setWorkdirConfig(null)
    }
  }, [modal.activeModal, modal.modalData, session.clientRef])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modals
      if (e.key === 'Escape' && modal.modalStack.length > 0) {
        modal.closeModal()
        return
      }
      // Ctrl/Cmd+K focuses search box
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      // Ctrl/Cmd+O toggles detailed view
      if ((e.ctrlKey || e.metaKey) && e.key === 'o' && session.activeSessionId) {
        e.preventDefault()
        setShowTranscript(s => !s)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [modal.modalStack.length, modal.closeModal, session.activeSessionId])

  // Workdir collapse functions
  const toggleWorkdirCollapse = (workdir: string) => {
    setCollapsedWorkdirs(prev => ({
      ...prev,
      [workdir]: !prev[workdir]
    }))
  }

  const collapseAllWorkdirs = () => {
    const allWorkdirs = [...new Set(session.sessions.map(s => s.workdir))]
    const allCollapsed = allWorkdirs.every(w => collapsedWorkdirs[w])

    if (allCollapsed) {
      setCollapsedWorkdirs({})
    } else {
      const collapsed: Record<string, boolean> = {}
      allWorkdirs.forEach(w => { collapsed[w] = true })
      setCollapsedWorkdirs(collapsed)
    }
  }

  // Session visibility functions
  const showMoreSessions = (workdir: string, count: number) => {
    setVisibleCounts(prev => ({
      ...prev,
      [workdir]: (prev[workdir] ?? DEFAULT_VISIBLE_SESSIONS) + count
    }))
  }

  const showAllSessions = (workdir: string, total: number) => {
    setVisibleCounts(prev => ({
      ...prev,
      [workdir]: total
    }))
  }

  // Input handling
  const handleInputChange = (value: string) => {
    setInputText(value)
    if (value.startsWith('/')) {
      slashCommands.setSlashFilter(value.slice(1))
      slashCommands.openSlashMenu()
    } else {
      slashCommands.closeSlashMenu()
    }
  }

  const handleSend = async () => {
    if (!inputText.trim()) return
    setInputText('')
    slashCommands.closeSlashMenu()
    await session.sendMessage(inputText)
  }

  // File browser handlers
  const openFileBrowser = (initialPath: string = '') => {
    modal.openModal('fileBrowser')
    fileBrowser.loadBrowsePath(initialPath)
  }

  const selectDirectory = (path: string) => {
    setNewSessionForm(s => ({ ...s, workdir: path }))
    modal.closeModal()
    fileBrowser.reset()
  }

  // Session creation
  const handleCreateSession = async () => {
    if (!newSessionForm.workdir) return

    // Auto-name from first message if no name provided
    let sessionName = newSessionForm.name
    if (!sessionName && newSessionForm.prompt) {
      sessionName = newSessionForm.prompt.slice(0, MAX_SESSION_NAME_LENGTH).trim()
      if (newSessionForm.prompt.length > MAX_SESSION_NAME_LENGTH && sessionName.includes(' ')) {
        sessionName = sessionName.slice(0, sessionName.lastIndexOf(' ')) + '...'
      }
    }

    modal.closeAllModals()
    setNewSessionForm({ workdir: '', prompt: '', name: '', permissionMode: 'default' })

    await session.createSession(
      newSessionForm.workdir,
      newSessionForm.prompt || undefined,
      sessionName || undefined,
      newSessionForm.permissionMode
    )
  }

  // New session from sidebar
  const handleNewSession = (workdir?: string) => {
    if (workdir) {
      setNewSessionForm(s => ({ ...s, workdir }))
    }
    modal.openModal('newSession')
  }

  // Permission mode change
  const handlePermissionModeChange = async (sessionId: string, newMode: string) => {
    if (newMode === 'dangerously-skip-permissions') {
      setPendingPermissionChange({ sessionId, mode: newMode })
    } else {
      await session.updateSessionPermissionMode(sessionId, newMode)
    }
  }

  const confirmPermissionChange = async () => {
    if (pendingPermissionChange) {
      await session.updateSessionPermissionMode(
        pendingPermissionChange.sessionId,
        pendingPermissionChange.mode
      )
    }
    setPendingPermissionChange(null)
  }

  // Session selection
  const handleSelectSession = async (sessionId: string) => {
    setSidebarOpen(false)
    await session.selectSession(sessionId)
  }

  // Login screen
  if (!session.connected) {
    return (
      <LoginView
        token={token}
        loginError={session.loginError}
        onTokenChange={setToken}
        onConnect={session.connect}
      />
    )
  }

  return (
    <div class="app">
      <Sidebar
        isOpen={sidebarOpen}
        isRefreshing={session.isRefreshing}
        groups={sessionGroups.filteredGroups}
        activeSessionId={session.activeSessionId}
        searchQuery={searchQuery}
        filter={filter}
        collapsedWorkdirs={collapsedWorkdirs}
        visibleCounts={visibleCounts}
        defaultVisibleCount={DEFAULT_VISIBLE_SESSIONS}
        editingSessionId={sidebarRename.editingId}
        editedName={sidebarRename.editedName}
        searchInputRef={searchInputRef}
        sessionListRef={sessionListRef}
        searchExpandedWorkdirs={sessionGroups.searchExpandedWorkdirs}
        onClose={() => setSidebarOpen(false)}
        onRefresh={session.refreshSessions}
        onCollapseAll={collapseAllWorkdirs}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery('')}
        onFilterChange={setFilter}
        onNewSession={handleNewSession}
        onOpenConfig={(workdir) => modal.openModal('workdirConfig', workdir)}
        onSelectSession={handleSelectSession}
        onToggleWorkdirCollapse={toggleWorkdirCollapse}
        onShowMore={showMoreSessions}
        onShowAll={showAllSessions}
        onStartRename={(id, name) => sidebarRename.startRename(id, name)}
        onEditedNameChange={sidebarRename.setEditedName}
        onSaveRename={sidebarRename.saveRename}
        onCancelRename={sidebarRename.cancelRename}
      />

      <div class="main">
        <div class="main-header">
          <button class="hamburger" onClick={() => setSidebarOpen(s => !s)}>
            <span /><span /><span />
          </button>

          {session.activeSession ? (
            <SessionHeader
              session={session.activeSession}
              showTranscript={showTranscript}
              editingName={headerRename.editingId === session.activeSession.id}
              editedName={headerRename.editedName}
              onToggleTranscript={() => setShowTranscript(s => !s)}
              onStartRename={() => headerRename.startRename(
                session.activeSession!.id,
                session.activeSession!.name ?? ''
              )}
              onEditedNameChange={headerRename.setEditedName}
              onSaveRename={headerRename.saveRename}
              onCancelRename={headerRename.cancelRename}
              onPermissionModeChange={handlePermissionModeChange}
              onInterrupt={() => session.interruptSession(session.activeSessionId!)}
              onDelete={() => session.deleteSession(session.activeSessionId!)}
            />
          ) : (
            <div class="session-info">
              <h3>Clarvis</h3>
            </div>
          )}
        </div>

        {session.activeSession ? (
          <>
            <MessageList
              messages={session.sessionMessages}
              interactions={session.interactions[session.activeSessionId ?? ''] ?? []}
              attention={session.sessionAttention}
              showTranscript={showTranscript}
              awaitingResponse={session.awaitingResponse}
              onResolveAttention={session.resolveAttention}
            />
            <MessageInput
              inputText={inputText}
              showSlashMenu={slashCommands.showSlashMenu}
              filteredCommands={slashCommands.filteredCommands}
              selectedSlashIndex={slashCommands.selectedSlashIndex}
              disabled={false}
              onInputChange={handleInputChange}
              onSend={handleSend}
              onSlashTrigger={slashCommands.openSlashMenu}
              onSlashSelect={(cmd) => setInputText(slashCommands.selectCommand(cmd))}
              onArrowDown={slashCommands.handleArrowDown}
              onArrowUp={slashCommands.handleArrowUp}
              onCloseSlashMenu={slashCommands.closeSlashMenu}
            />
          </>
        ) : (
          <div class="no-session">
            <div class="no-session-content">
              <h2>Welcome to Clarvis</h2>
              <p>Select a session from the sidebar or create a new one to get started.</p>
              <button class="btn-primary" onClick={() => modal.openModal('newSession')}>
                Create New Session
              </button>
            </div>
          </div>
        )}
      </div>

      <ModalContainer
        modalStack={modal.modalStack}
        newSessionForm={newSessionForm}
        browserPath={fileBrowser.browserPath}
        browserEntries={fileBrowser.browserEntries}
        workdirConfig={workdirConfig}
        onNewSessionFormChange={(updates) => setNewSessionForm(s => ({ ...s, ...updates }))}
        onOpenFileBrowser={openFileBrowser}
        onNavigateUp={fileBrowser.navigateUp}
        onNavigateTo={fileBrowser.loadBrowsePath}
        onSelectDirectory={selectDirectory}
        onCreateSession={handleCreateSession}
        onCloseModal={modal.closeModal}
        onCloseAllModals={modal.closeAllModals}
      />

      {pendingPermissionChange && (
        <ConfirmPermissionModal
          onConfirm={confirmPermissionChange}
          onCancel={() => setPendingPermissionChange(null)}
        />
      )}
    </div>
  )
}
