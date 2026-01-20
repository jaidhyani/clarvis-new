import { existsSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'
import { MIME_TYPES } from '../config.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(__dirname, '../../../public')
const DIST_DIR = join(__dirname, '../../../dist')

export function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  let pathname = req.url?.split('?')[0] ?? '/'
  if (pathname === '/') pathname = '/index.html'

  // In production, serve from dist directory
  const distPath = join(DIST_DIR, pathname)
  const publicPath = join(PUBLIC_DIR, pathname)

  // Try dist first (for built assets), then public
  const filepath = existsSync(distPath) ? distPath : publicPath

  if (!existsSync(filepath)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const ext = extname(filepath)
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

  const content = readFileSync(filepath)
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(content)
}
