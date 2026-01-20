import { useMemo } from 'preact/hooks'
import Fuse from 'fuse.js'
import type { Attention, Session, WorkdirGroup } from '@/types/session.ts'
import type { SessionFilter } from '@/types/ui.ts'
import { getWorkdirName } from '@/utils/content.ts'

/**
 * Groups sessions by workdir with attention data.
 * Returns groups sorted by most recently modified session.
 */
function groupByWorkdir(sessions: Session[], attention: Attention[]): WorkdirGroup[] {
  const attentionBySession: Record<string, Attention[]> = {}
  for (const a of attention) {
    const existing = attentionBySession[a.sessionId]
    if (existing) {
      existing.push(a)
    } else {
      attentionBySession[a.sessionId] = [a]
    }
  }

  const groups: Record<string, WorkdirGroup> = {}
  for (const session of sessions) {
    const workdir = session.workdir || 'Unknown'
    const name = getWorkdirName(workdir)

    const group = groups[workdir]
    if (group) {
      group.sessions.push({
        ...session,
        attention: attentionBySession[session.id] ?? []
      })
    } else {
      groups[workdir] = {
        name,
        workdir,
        sessions: [{
          ...session,
          attention: attentionBySession[session.id] ?? []
        }]
      }
    }
  }

  // Sort sessions within each group by modified (most recent first)
  for (const workdir in groups) {
    const group = groups[workdir]
    if (group) {
      group.sessions.sort((a, b) =>
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
      )
    }
  }

  // Sort workdirs by their most recent session
  const sortedWorkdirs = Object.keys(groups).sort((a, b) => {
    const aLatest = groups[a]?.sessions[0]?.modified ?? ''
    const bLatest = groups[b]?.sessions[0]?.modified ?? ''
    return new Date(bLatest).getTime() - new Date(aLatest).getTime()
  })

  return sortedWorkdirs.map(workdir => groups[workdir]).filter((g): g is WorkdirGroup => g !== undefined)
}

interface UseSessionGroupsReturn {
  groups: WorkdirGroup[]
  filteredGroups: WorkdirGroup[]
  searchExpandedWorkdirs: Record<string, boolean>
}

/**
 * Computes session groups with search and attention filtering.
 */
export function useSessionGroups(
  sessions: Session[],
  attention: Attention[],
  searchQuery: string,
  filter: SessionFilter
): UseSessionGroupsReturn {
  const groups = useMemo(
    () => groupByWorkdir(sessions, attention),
    [sessions, attention]
  )

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    const searchableItems = sessions.map(s => ({
      ...s,
      workdirName: getWorkdirName(s.workdir),
      displayName: s.name ?? s.id.slice(0, 12)
    }))
    return new Fuse(searchableItems, {
      keys: ['displayName', 'name', 'workdirName', 'workdir'],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true
    })
  }, [sessions])

  // Filter groups by search query
  const searchFilteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups

    const results = fuse.search(searchQuery)
    const matchedSessionIds = new Set(results.map(r => r.item.id))
    const matchedWorkdirs = new Set<string>()

    // Check if any workdir names match the search
    const workdirFuse = new Fuse(
      groups.map(g => ({ workdir: g.workdir, name: g.name })),
      {
        keys: ['name', 'workdir'],
        threshold: 0.4,
        includeScore: true
      }
    )
    const workdirResults = workdirFuse.search(searchQuery)
    workdirResults.forEach(r => matchedWorkdirs.add(r.item.workdir))

    return groups
      .map(g => {
        // If workdir matches, include all sessions
        if (matchedWorkdirs.has(g.workdir)) {
          return g
        }
        // Otherwise only include matched sessions
        return {
          ...g,
          sessions: g.sessions.filter(s => matchedSessionIds.has(s.id))
        }
      })
      .filter(g => g.sessions.length > 0)
  }, [groups, searchQuery, fuse])

  // Apply attention filter on top of search filter
  const filteredGroups = useMemo(() => {
    if (filter !== 'attention') return searchFilteredGroups

    return searchFilteredGroups
      .map(g => ({
        ...g,
        sessions: g.sessions.filter(s => s.attention.length > 0)
      }))
      .filter(g => g.sessions.length > 0)
  }, [searchFilteredGroups, filter])

  // Auto-expand workdirs that have search matches
  const searchExpandedWorkdirs = useMemo(() => {
    if (!searchQuery.trim()) return {}

    const expanded: Record<string, boolean> = {}
    filteredGroups.forEach(g => {
      expanded[g.workdir] = false // false means NOT collapsed (expanded)
    })
    return expanded
  }, [searchQuery, filteredGroups])

  return {
    groups,
    filteredGroups,
    searchExpandedWorkdirs
  }
}
