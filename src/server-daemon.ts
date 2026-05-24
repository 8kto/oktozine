#!/usr/bin/env node
/**
 * Standalone static file server daemon.
 * Spawned as a detached background process by build-module when keepWebServer is true.
 *
 * argv: <serveDir> <port> <pidFile>
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const [, , serveDir, portStr, pidFile] = process.argv

if (!serveDir || !portStr || !pidFile) {
  process.stderr.write('Usage: server-daemon <serveDir> <port> <pidFile>\n')
  process.exit(1)
}

const port = Number(portStr)

const MIME: Record<string, string> = {
  '.avif': 'image/avif',
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  const filePath = path.join(serveDir, urlPath)

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()

    return
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404)
      res.end()

      return
    }

    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
})

server.listen(port, '127.0.0.1', () => {
  fs.writeFileSync(pidFile, String(process.pid), 'utf8')
  process.stdout.write(`Web server: serving ${serveDir} on http://localhost:${port}\n`)
})

server.on('error', (err) => {
  process.stderr.write(`Web server error: ${err.message}\n`)
  process.exit(1)
})
