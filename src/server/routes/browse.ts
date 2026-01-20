import { existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import { ALLOWED_ROOTS } from '../config.ts'

interface BrowserEntry {
  name: string
  path: string
  type: 'directory' | 'file'
}

function isWithinAllowedRoots(targetPath: string): boolean {
  const normalized = resolve(targetPath)
  return ALLOWED_ROOTS.some(root =>
    normalized === root || normalized.startsWith(root + '/')
  )
}

export function handleBrowse(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const requestedPath = url.searchParams.get('path') ?? ''

  res.setHeader('Content-Type', 'application/json')

  // No path = list allowed roots
  if (!requestedPath) {
    const roots: BrowserEntry[] = ALLOWED_ROOTS.map(root => ({
      name: root.split('/').pop() ?? root,
      path: root,
      type: 'directory'
    }))
    res.end(JSON.stringify({ entries: roots, path: '', isRoot: true }))
    return
  }

  // Validate path is within allowed roots
  const normalizedPath = resolve(requestedPath)
  if (!isWithinAllowedRoots(normalizedPath)) {
    res.writeHead(403)
    res.end(JSON.stringify({ error: 'Access denied' }))
    return
  }

  // Check path exists
  if (!existsSync(normalizedPath)) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Path not found' }))
    return
  }

  try {
    const entries: BrowserEntry[] = readdirSync(normalizedPath)
      .filter(name => !name.startsWith('.'))
      .map(name => {
        const fullPath = join(normalizedPath, name)
        try {
          const stat = statSync(fullPath)
          return {
            name,
            path: fullPath,
            type: stat.isDirectory() ? 'directory' as const : 'file' as const
          }
        } catch {
          return null
        }
      })
      .filter((e): e is BrowserEntry => e !== null && e.type === 'directory')
      .sort((a, b) => a.name.localeCompare(b.name))

    res.end(JSON.stringify({ entries, path: normalizedPath, isRoot: false }))
  } catch {
    res.writeHead(500)
    res.end(JSON.stringify({ error: 'Failed to read directory' }))
  }
}
