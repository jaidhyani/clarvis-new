import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'http'
import { CLAUDEKEEPER_HOST } from '../config.ts'

export function proxyRequest(req: IncomingMessage, res: ServerResponse): void {
  const proxyReq = httpRequest({
    hostname: CLAUDEKEEPER_HOST.hostname,
    port: CLAUDEKEEPER_HOST.port || 80,
    path: req.url?.replace(/^\/api/, '') ?? '/',
    method: req.method,
    headers: {
      ...req.headers,
      host: CLAUDEKEEPER_HOST.host
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message)
    res.writeHead(502)
    res.end(JSON.stringify({ error: 'Backend unavailable' }))
  })

  req.pipe(proxyReq)
}
