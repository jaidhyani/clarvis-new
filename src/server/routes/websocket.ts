import { request as httpRequest, type IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { CLAUDEKEEPER_HOST } from '../config.ts'

export function proxyWebSocket(req: IncomingMessage, socket: Duplex, _head: Buffer): void {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const token = url.searchParams.get('token')

  const proxyReq = httpRequest({
    hostname: CLAUDEKEEPER_HOST.hostname,
    port: CLAUDEKEEPER_HOST.port || 80,
    path: `/?token=${token}`,
    method: 'GET',
    headers: {
      ...req.headers,
      host: CLAUDEKEEPER_HOST.host,
      connection: 'Upgrade',
      upgrade: 'websocket'
    }
  })

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n')

    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) {
        socket.write(`${key}: ${value}\r\n`)
      }
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
      if (value !== undefined) {
        socket.write(`${key}: ${value}\r\n`)
      }
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
