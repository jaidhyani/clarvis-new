import { useState, useCallback } from 'preact/hooks'
import type { BrowserEntry } from '@/types/api.ts'
import type { ClaudekeeperClient } from '@/api/client.ts'

export interface UseFileBrowserReturn {
  browserPath: string
  browserEntries: BrowserEntry[]
  browserHistory: string[]
  loadBrowsePath: (path?: string) => Promise<void>
  navigateUp: () => void
  reset: () => void
}

/**
 * Manages file browser navigation state and history.
 */
export function useFileBrowser(client: ClaudekeeperClient | null): UseFileBrowserReturn {
  const [browserPath, setBrowserPath] = useState('')
  const [browserEntries, setBrowserEntries] = useState<BrowserEntry[]>([])
  const [browserHistory, setBrowserHistory] = useState<string[]>([])

  const loadBrowsePath = useCallback(async (path: string = '') => {
    if (!client) return

    try {
      const data = await client.browse(path)
      setBrowserEntries(data.entries ?? [])
      setBrowserPath(data.path ?? '')

      if (path && !data.isRoot) {
        setBrowserHistory(prev => [...prev, path])
      } else if (!path) {
        setBrowserHistory([])
      }
    } catch (e) {
      console.error('Browse error:', e)
    }
  }, [client])

  const navigateUp = useCallback(() => {
    if (browserHistory.length > 1) {
      const newHistory = browserHistory.slice(0, -1)
      setBrowserHistory(newHistory)
      const parentPath = newHistory[newHistory.length - 1] ?? ''

      if (parentPath && client) {
        client.browse(parentPath).then(data => {
          setBrowserEntries(data.entries ?? [])
          setBrowserPath(data.path ?? '')
        }).catch(() => {
          // Fall back to root
          loadBrowsePath('')
        })
      } else {
        loadBrowsePath('')
      }
    } else {
      loadBrowsePath('')
    }
  }, [browserHistory, client, loadBrowsePath])

  const reset = useCallback(() => {
    setBrowserPath('')
    setBrowserEntries([])
    setBrowserHistory([])
  }, [])

  return {
    browserPath,
    browserEntries,
    browserHistory,
    loadBrowsePath,
    navigateUp,
    reset
  }
}
