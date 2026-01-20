import { resolve } from 'path'
import { homedir } from 'os'

export const PORT = parseInt(process.env.PORT || '3000', 10)

export const CLAUDEKEEPER_URL = process.env.CLAUDEKEEPER_URL || 'http://localhost:3100'

export const CLAUDEKEEPER_HOST = new URL(CLAUDEKEEPER_URL)

const rawRoots = (process.env.ALLOWED_ROOTS || '')
  .split(',')
  .map(p => p.trim())
  .filter(Boolean)
  .map(p => resolve(p))

export const ALLOWED_ROOTS: string[] = rawRoots.length > 0
  ? rawRoots
  : [resolve(homedir())]

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}
