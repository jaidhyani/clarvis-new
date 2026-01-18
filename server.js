import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(__dirname, 'public')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}

function serveStatic(req, res) {
  let pathname = req.url.split('?')[0]
  if (pathname === '/') pathname = '/index.html'

  const filepath = join(PUBLIC_DIR, pathname)

  if (!existsSync(filepath)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const ext = extname(filepath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  const content = readFileSync(filepath)
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(content)
}

const port = parseInt(process.env.PORT || '3000', 10)

const server = createServer(serveStatic)
server.listen(port, () => {
  console.log(`Clarvis running on http://localhost:${port}`)
})
