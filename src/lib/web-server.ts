import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import httpServerLib from 'http-server'

import { logger } from './logger'

/** Minimal handle returned by startStaticServer — just needs to be closeable. */
export type ServerHandle = { close: () => void }

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

/** Resolves when something starts listening on `port`, or rejects after `timeoutMs`. */
const waitForPort = (port: number, timeoutMs = 5000): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const check = () => {
      isPortFree(port).then((free) => {
        if (!free) {
          resolve()

          return
        }
        if (Date.now() > deadline) {
          reject(new Error(`Server did not become available on port ${port} within ${timeoutMs} ms`))

          return
        }
        setTimeout(check, 50)
      })
    }
    setTimeout(check, 50)
  })

export const getServerPidFile = (port: number): string =>
  path.join(os.tmpdir(), `oktozine-server-${port}.pid`)

/**
 * Starts an http-server instance serving `serveDir` on the given port.
 * If the port is already occupied, assumes an existing process is serving and
 * returns `null` (the caller should not attempt to close it).
 */
export const startStaticServer = async (serveDir: string, port: number): Promise<ServerHandle | null> => {
  if (!(await isPortFree(port))) {
    logger.info(`Web server: port ${port} already in use — reusing existing process`)

    return null
  }

  const server = httpServerLib.createServer({ root: serveDir, cors: true, cache: -1 })
  // http-server delegates listen() to node's http.Server, so hostname arg is accepted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await new Promise<void>((resolve) => (server as any).listen(port, '127.0.0.1', resolve))
  logger.info(`Web server: serving ${serveDir} on http://localhost:${port}`)

  return server
}

export const stopStaticServer = (server: ServerHandle | null): void => {
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
  const daemonScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server-daemon.js')

  const child = spawn(process.execPath, [daemonScript, serveDir, String(port), pidFile], {
    detached: true,
    stdio: 'ignore',
  })
  // Write PID before unreffing so stopServerDaemon can find the process later
  fs.writeFileSync(pidFile, String(child.pid), 'utf8')
  child.unref()

  // Wait until the daemon is actually accepting connections
  await waitForPort(port)
  logger.info(`Web server: daemon started on http://localhost:${port} (pid: ${child.pid})`)
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
