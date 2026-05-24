import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { logger } from './logger'

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

const isPortFree = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => {
      probe.close()
      resolve(true)
    })
    probe.listen(port, '127.0.0.1')
  })

export const getServerPidFile = (port: number): string => path.join(os.tmpdir(), `oktozine-server-${port}.pid`)

/**
 * Starts a static file server serving `serveDir` on the given port.
 * If the port is already occupied, assumes an existing process is serving and
 * returns `null` (the caller should not attempt to close it).
 */
export const startStaticServer = async (serveDir: string, port: number): Promise<http.Server | null> => {
  if (!(await isPortFree(port))) {
    logger.info(`Web server: port ${port} already in use — reusing existing process`)

    return null
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

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  logger.info(`Web server: serving ${serveDir} on http://localhost:${port}`)

  return server
}

export const stopStaticServer = (server: http.Server | null): void => {
  if (server) {
    server.close()
    logger.info('Web server: stopped')
  }
}

/**
 * Spawns server-daemon.js as a detached background process so the parent
 * process can exit while the server keeps running.
 * No-op if the port is already occupied.
 */
export const spawnServerDaemon = async (serveDir: string, port: number): Promise<void> => {
  if (!(await isPortFree(port))) {
    logger.info(`Web server: port ${port} already in use — reusing existing process`)

    return
  }

  const pidFile = getServerPidFile(port)
  // Resolve daemon script relative to this compiled file (dist/lib/ → dist/)
  const daemonScript = path.resolve(fileURLToPath(import.meta.url), '../../server-daemon.js')

  const child = spawn(process.execPath, [daemonScript, serveDir, String(port), pidFile], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  // Wait until the daemon writes its PID file (signals it's listening)
  await new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 5000
    const check = () => {
      if (fs.existsSync(pidFile)) {
        resolve()

        return
      }
      if (Date.now() > deadline) {
        reject(new Error(`Web server daemon did not start within 5 s (port ${port})`))

        return
      }
      setTimeout(check, 100)
    }
    check()
  })

  logger.info(`Web server: daemon started on http://localhost:${port} (pid file: ${pidFile})`)
}

/**
 * Kills the background server daemon started for `port`, if one is running.
 */
export const stopServerDaemon = (port: number): void => {
  const pidFile = getServerPidFile(port)
  if (!fs.existsSync(pidFile)) {
    logger.info(`Web server: no daemon found for port ${port}`)

    return
  }

  const pid = Number(fs.readFileSync(pidFile, 'utf8').trim())
  try {
    process.kill(pid, 'SIGTERM')
    logger.info(`Web server: daemon stopped (pid ${pid})`)
  } catch {
    logger.warn(`Web server: could not kill pid ${pid} — process may have already exited`)
  }

  fs.rmSync(pidFile, { force: true })
}
