import { createServer } from 'http'
import { PORT, CLAUDEKEEPER_URL } from './config.ts'
import { serveStatic } from './routes/static.ts'
import { proxyRequest } from './routes/api-proxy.ts'
import { handleBrowse } from './routes/browse.ts'
import { proxyWebSocket } from './routes/websocket.ts'
import type { IncomingMessage, ServerResponse } from 'http'

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/'

  if (url.startsWith('/api/browse')) {
    handleBrowse(req, res)
  } else if (url.startsWith('/api/')) {
    proxyRequest(req, res)
  } else {
    serveStatic(req, res)
  }
}

const server = createServer(handleRequest)

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/ws')) {
    proxyWebSocket(req, socket, head)
  } else {
    socket.destroy()
  }
})

server.listen(PORT, () => {
  console.log(`Clarvis running on http://localhost:${PORT}`)
  console.log(`Proxying to Claudekeeper at ${CLAUDEKEEPER_URL}`)
})
