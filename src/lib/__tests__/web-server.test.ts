import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import {
  getServerPidFile,
  type ServerHandle,
  startStaticServer,
  stopServerDaemon,
  stopStaticServer,
} from '../web-server'

/** Bind to port 0 to get a free port from the OS, then release it. */
const getFreePort = (): Promise<number> =>
  new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })

// ─── getServerPidFile ────────────────────────────────────────────────────────

describe('getServerPidFile', () => {
  it('returns a path inside tmpdir that includes the port number', () => {
    expect(getServerPidFile(3001)).toBe(path.join(os.tmpdir(), 'oktozine-server-3001.pid'))
    expect(getServerPidFile(8080)).toBe(path.join(os.tmpdir(), 'oktozine-server-8080.pid'))
  })
})

// ─── startStaticServer / stopStaticServer ───────────────────────────────────

describe('startStaticServer / stopStaticServer', () => {
  let port: number
  let serveDir: string
  let server: ServerHandle | null = null

  beforeEach(async () => {
    port = await getFreePort()
    serveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oktozine-ws-'))
  })

  afterEach(() => {
    stopStaticServer(server)
    server = null
    fs.rmSync(serveDir, { recursive: true, force: true })
  })

  it('starts a server and serves static files', async () => {
    fs.writeFileSync(path.join(serveDir, 'hello.txt'), 'world')

    server = await startStaticServer(serveDir, port)
    expect(server).not.toBeNull()

    const res = await fetch(`http://127.0.0.1:${port}/hello.txt`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('world')
  })

  it('sets CORS header on responses', async () => {
    fs.writeFileSync(path.join(serveDir, 'data.json'), '{}')

    server = await startStaticServer(serveDir, port)

    const res = await fetch(`http://127.0.0.1:${port}/data.json`)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('returns 404 for missing files', async () => {
    server = await startStaticServer(serveDir, port)

    const res = await fetch(`http://127.0.0.1:${port}/nope.txt`)
    expect(res.status).toBe(404)
  })

  it('returns null when the port is already in use', async () => {
    server = await startStaticServer(serveDir, port)
    expect(server).not.toBeNull()

    const second = await startStaticServer(serveDir, port)
    expect(second).toBeNull()
  })

  it('stopStaticServer(null) does not throw', () => {
    expect(() => stopStaticServer(null)).not.toThrow()
  })

  it('stops the server so further requests fail', async () => {
    fs.writeFileSync(path.join(serveDir, 'test.txt'), 'hi')

    server = await startStaticServer(serveDir, port)
    expect((await fetch(`http://127.0.0.1:${port}/test.txt`)).ok).toBe(true)

    stopStaticServer(server)
    server = null

    await expect(fetch(`http://127.0.0.1:${port}/test.txt`)).rejects.toThrow()
  })
})

// ─── stopServerDaemon ───────────────────────────────────────────────────────

describe('stopServerDaemon', () => {
  it('does not throw when no PID file exists', () => {
    expect(() => stopServerDaemon(49997)).not.toThrow()
  })

  it('removes the PID file and handles a dead PID gracefully', () => {
    const port = 49996
    const pidFile = getServerPidFile(port)
    fs.writeFileSync(pidFile, '9999999') // PID that almost certainly does not exist

    expect(() => stopServerDaemon(port)).not.toThrow()
    expect(fs.existsSync(pidFile)).toBe(false)
  })

  it('sends SIGTERM and removes PID file for a live process', async () => {
    const port = 49995
    const pidFile = getServerPidFile(port)

    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    fs.writeFileSync(pidFile, String(child.pid))

    stopServerDaemon(port)

    expect(fs.existsSync(pidFile)).toBe(false)

    // Give the OS a moment to reap the process, then verify it's gone
    await new Promise((resolve) => setTimeout(resolve, 100))
    let alive = false
    try {
      process.kill(child.pid!, 0)
      alive = true
    } catch {
      alive = false
    }
    expect(alive).toBe(false)
  })
})
