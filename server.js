import { createServer, request as httpRequest } from 'http'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, extname, resolve, normalize } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(__dirname, 'public')

const CLAUDEKEEPER_URL = process.env.CLAUDEKEEPER_URL || 'http://localhost:3100'
const ckUrl = new URL(CLAUDEKEEPER_URL)

const ALLOWED_ROOTS = (process.env.ALLOWED_ROOTS || '')
  .split(',')
  .map(p => p.trim())
  .filter(Boolean)
  .map(p => resolve(p))

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

function proxyRequest(req, res) {
  const proxyReq = httpRequest({
    hostname: ckUrl.hostname,
    port: ckUrl.port || 80,
    path: req.url.replace(/^\/api/, ''),
    method: req.method,
    headers: {
      ...req.headers,
      host: ckUrl.host
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message)
    res.writeHead(502)
    res.end(JSON.stringify({ error: 'Backend unavailable' }))
  })

  req.pipe(proxyReq)
}

function isWithinAllowedRoots(targetPath) {
  const normalized = resolve(targetPath)
  return ALLOWED_ROOTS.some(root => normalized === root || normalized.startsWith(root + '/'))
}

function handleBrowse(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const requestedPath = url.searchParams.get('path') || ''

  res.setHeader('Content-Type', 'application/json')

  if (!requestedPath) {
    const roots = ALLOWED_ROOTS.map(root => ({
      name: root.split('/').pop() || root,
      path: root,
      type: 'directory'
    }))
    res.end(JSON.stringify({ entries: roots, path: '', isRoot: true }))
    return
  }

  const normalizedPath = resolve(requestedPath)
  if (!isWithinAllowedRoots(normalizedPath)) {
    res.writeHead(403)
    res.end(JSON.stringify({ error: 'Access denied' }))
    return
  }

  if (!existsSync(normalizedPath)) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Path not found' }))
    return
  }

  try {
    const entries = readdirSync(normalizedPath)
      .filter(name => !name.startsWith('.'))
      .map(name => {
        const fullPath = join(normalizedPath, name)
        try {
          const stat = statSync(fullPath)
          return {
            name,
            path: fullPath,
            type: stat.isDirectory() ? 'directory' : 'file'
          }
        } catch {
          return null
        }
      })
      .filter(e => e && e.type === 'directory')
      .sort((a, b) => a.name.localeCompare(b.name))

    res.end(JSON.stringify({ entries, path: normalizedPath, isRoot: false }))
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: 'Failed to read directory' }))
  }
}

function handleRequest(req, res) {
  if (req.url.startsWith('/api/browse')) {
    handleBrowse(req, res)
  } else if (req.url.startsWith('/api/')) {
    proxyRequest(req, res)
  } else {
    serveStatic(req, res)
  }
}

function proxyWebSocket(req, socket, head) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const token = url.searchParams.get('token')

  const proxyReq = httpRequest({
    hostname: ckUrl.hostname,
    port: ckUrl.port || 80,
    path: `/?token=${token}`,
    method: 'GET',
    headers: {
      ...req.headers,
      host: ckUrl.host,
      connection: 'Upgrade',
      upgrade: 'websocket'
    }
  })

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n')
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      socket.write(`${key}: ${value}\r\n`)
    }
    socket.write('\r\n')

    if (proxyHead.length > 0) {
      socket.write(proxyHead)
    }

    proxySocket.pipe(socket)
    socket.pipe(proxySocket)

    proxySocket.on('error', () => socket.destroy())
    socket.on('error', () => proxySocket.destroy())
  })

  proxyReq.on('response', (proxyRes) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`
    socket.write(statusLine)
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      socket.write(`${key}: ${value}\r\n`)
    }
    socket.write('\r\n')
    proxyRes.pipe(socket)
  })

  proxyReq.on('error', (err) => {
    console.error('WebSocket proxy error:', err.message)
    socket.destroy()
  })

  proxyReq.end()
}

const port = parseInt(process.env.PORT || '3000', 10)

const server = createServer(handleRequest)

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    proxyWebSocket(req, socket, head)
  } else {
    socket.destroy()
  }
})

server.listen(port, () => {
  console.log(`Clarvis running on http://localhost:${port}`)
  console.log(`Proxying to Claudekeeper at ${CLAUDEKEEPER_URL}`)
})
