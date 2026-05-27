#!/usr/bin/env node
/**
 * Standalone static file server daemon.
 * Spawned as a detached background process by build-module when keepWebServer is true.
 * Uses http-server for reliable concurrent connection handling.
 *
 * argv: <serveDir> <port> <pidFile>
 */

import fs from 'node:fs'

import httpServerLib from 'http-server'

const [, , serveDir, portStr, pidFile] = process.argv

if (!serveDir || !portStr || !pidFile) {
  process.stderr.write('Usage: server-daemon <serveDir> <port> <pidFile>\n')
  process.exit(1)
}

const port = Number(portStr)
const server = httpServerLib.createServer({ root: serveDir, cors: true, cache: -1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(server as any).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Web server: serving ${serveDir} on http://localhost:${port}\n`)
  // PID file is written by the parent process before it unrefs this child
})
