/**
 * dsh-browser-use — Host half (v0.2 integrated browser).
 *
 * Launches a dedicated Google Chrome with CDP on 127.0.0.1:9223 and serves the
 * mirror routes used by the right-Sidebar "Browser use" tab. The Playwright MCP
 * provider attaches to the same CDP endpoint, so the agent's browser tools drive
 * exactly the page the mirror renders.
 *
 * The agent cursor is injected into the page itself (a shadow-DOM overlay that
 * follows trusted pointer events and pulses on clicks), so it shows up both in
 * the integrated mirror and in the real Chrome window.
 *
 *   GET  /api/browser-use/status    — Chrome/page status
 *   GET  /api/browser-use/frame.jpg — current page screenshot (JPEG)
 *   POST /api/browser-use/launch    — (re)launch Chrome and wait for CDP
 *
 * @module dsh-browser-use
 */
import { execFile, spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const PORT = 9223
const ENDPOINT = `http://127.0.0.1:${PORT}`
const PROFILE_DIR = join(homedir(), '.dsh', 'browser-use', 'chrome-profile')
const OVERLAY_FLAG = '__dshAgentCursorOverlay'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function chromeCandidates() {
  if (process.env.DSH_BROWSER_USE_CHROME) return [process.env.DSH_BROWSER_USE_CHROME]
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    ]
  }
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
}

async function cdpUp() {
  try {
    const response = await fetch(`${ENDPOINT}/json/version`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch {
    return false
  }
}

let launching = null

/**
 * Ensure the dedicated Chrome is running with CDP. Idempotent and safe to call
 * from several routes concurrently.
 * @returns {Promise<boolean>}
 */
async function ensureChrome() {
  if (await cdpUp()) return true
  if (!launching) {
    launching = launchChrome().finally(() => {
      launching = null
    })
  }
  return launching
}

async function launchChrome() {
  await mkdir(PROFILE_DIR, { recursive: true })
  let lastError = 'no Chrome/Chromium executable found'
  for (const candidate of chromeCandidates()) {
    try {
      await run(candidate, ['--version'], { timeout: 5000 })
    } catch {
      continue
    }
    try {
      const child = spawn(
        candidate,
        [
          `--remote-debugging-port=${PORT}`,
          `--user-data-dir=${PROFILE_DIR}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-sync',
          '--disable-background-networking',
          '--window-size=1280,860',
          'about:blank',
        ],
        { detached: true, stdio: 'ignore' },
      )
      child.unref()
      const deadline = Date.now() + 20000
      while (Date.now() < deadline) {
        if (await cdpUp()) return true
        await sleep(250)
      }
      lastError = 'Chrome started but did not expose the CDP endpoint in time'
    } catch (error) {
      lastError = String(error?.message ?? error)
    }
  }
  throw new Error(`unable to launch the integrated browser: ${lastError}`)
}

/** @returns {Promise<Array<object>>} page targets without devtools pages */
async function listPages() {
  try {
    const response = await fetch(`${ENDPOINT}/json/list`, { signal: AbortSignal.timeout(2000) })
    if (!response.ok) return []
    const targets = await response.json()
    return targets.filter(
      (target) => target.type === 'page' && !String(target.url).startsWith('devtools://'),
    )
  } catch {
    return []
  }
}

/**
 * Preferred page: the most recently active real page, falling back to about:blank.
 * @param {Array<object>} pages
 * @returns {object | undefined}
 */
function pickPage(pages) {
  const real = pages.filter((page) => page.url && page.url !== 'about:blank')
  return real[real.length - 1] ?? pages[pages.length - 1]
}

/**
 * Minimal CDP client bound to one page target.
 * @param {string} wsUrl
 */
function connectTarget(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    let nextId = 0
    const pending = new Map()
    const client = {
      socket,
      send(method, params = {}) {
        return new Promise((resolveSend, rejectSend) => {
          const id = ++nextId
          pending.set(id, { resolve: resolveSend, reject: rejectSend })
          socket.send(JSON.stringify({ id, method, params }))
        })
      },
      close() {
        try {
          socket.close()
        } catch {
          /* already closed */
        }
      },
      get open() {
        return socket.readyState === 1
      },
    }
    socket.addEventListener('open', () => resolve(client))
    socket.addEventListener('message', (event) => {
      let message
      try {
        message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data))
      } catch {
        return
      }
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id)
        pending.delete(message.id)
        message.error
          ? entry.reject(new Error(message.error.message))
          : entry.resolve(message.result)
      }
    })
    socket.addEventListener('error', (event) => {
      const error = event?.error instanceof Error ? event.error : new Error('CDP socket error')
      reject(error)
      for (const entry of pending.values()) entry.reject(error)
      pending.clear()
    })
    socket.addEventListener('close', () => {
      for (const entry of pending.values()) entry.reject(new Error('CDP socket closed'))
      pending.clear()
    })
  })
}

const OVERLAY_SOURCE = `(() => {
  if (window.${OVERLAY_FLAG}) return 'already'
  window.${OVERLAY_FLAG} = true
  const HOST_ID = 'dsh-agent-cursor-host'
  const mount = () => {
    if (document.getElementById(HOST_ID)) return
    const host = document.createElement('div')
    host.id = HOST_ID
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;'
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<style>' +
      '.wrap{position:absolute;left:0;top:0;opacity:0;transition:transform 70ms linear,opacity 120ms ease;will-change:transform}' +
      '.wrap.on{opacity:1}' +
      'svg{display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}' +
      '.badge{position:absolute;left:21px;top:20px;background:#ff2fd0;color:#fff;font:600 10px/1 -apple-system,system-ui,sans-serif;padding:3px 6px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)}' +
      '.pulse{position:absolute;left:-10px;top:-10px;width:20px;height:20px;border-radius:50%;border:2px solid #ff4fdc;opacity:0}' +
      '.pulse.go{animation:dshpulse 520ms ease-out}' +
      '@keyframes dshpulse{0%{opacity:.95;transform:scale(.35)}100%{opacity:0;transform:scale(2.2)}}' +
      '</style>' +
      '<div class="wrap"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M4 2l12 9-5.1 1-2.2 5.3z" fill="#ff2fd0" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg><span class="badge">Agent</span><i class="pulse"></i></div>'
    document.documentElement.appendChild(host)
    const wrap = root.querySelector('.wrap')
    const pulse = root.querySelector('.pulse')
    let visible = false
    const show = (x, y) => {
      wrap.style.transform = 'translate(' + x + 'px,' + y + 'px)'
      if (!visible) { visible = true; wrap.classList.add('on') }
    }
    const ping = (x, y) => {
      show(x, y)
      pulse.classList.remove('go')
      void pulse.offsetWidth
      pulse.classList.add('go')
    }
    window.addEventListener('pointermove', (event) => show(event.clientX, event.clientY), true)
    window.addEventListener('mousemove', (event) => show(event.clientX, event.clientY), true)
    window.addEventListener('pointerdown', (event) => ping(event.clientX, event.clientY), true)
    window.addEventListener('mousedown', (event) => ping(event.clientX, event.clientY), true)
  }
  if (document.documentElement) mount()
  else document.addEventListener('DOMContentLoaded', mount, { once: true })
  return 'mounted'
})()`

let pageClient = null

async function ensurePageClient() {
  const pages = await listPages()
  const page = pickPage(pages)
  if (!page) return null
  if (!pageClient || pageClient.targetId !== page.id || !pageClient.open) {
    try {
      pageClient?.close()
    } catch {
      /* already closed */
    }
    pageClient = await connectTarget(page.webSocketDebuggerUrl)
    pageClient.targetId = page.id
    pageClient.injected = false
  }
  return pageClient
}

async function ensureOverlay(client) {
  if (!client.injected) {
    await client.send('Page.enable')
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: OVERLAY_SOURCE })
    await client.send('Runtime.evaluate', { expression: OVERLAY_SOURCE })
    client.injected = true
    return
  }
  try {
    const check = await client.send('Runtime.evaluate', {
      expression: `!!window.${OVERLAY_FLAG}`,
      returnByValue: true,
    })
    if (!check?.result?.value) {
      await client.send('Runtime.evaluate', { expression: OVERLAY_SOURCE })
    }
  } catch {
    /* a navigation can transiently reject evaluation; the injected script covers it */
  }
}

async function statusRoute() {
  const up = await cdpUp()
  if (!up) return json({ running: false, page: null })
  const page = pickPage(await listPages())
  return json({
    running: true,
    page: page ? { url: page.url, title: page.title } : null,
  })
}

async function frameRoute() {
  try {
    const client = await ensurePageClient()
    if (!client) return json({ error: 'no browser page yet' }, 503)
    await ensureOverlay(client)
    const shot = await client.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 72,
      optimizeForSpeed: true,
    })
    return new Response(Buffer.from(shot.data, 'base64'), {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' },
    })
  } catch (error) {
    try {
      pageClient?.close()
    } catch {
      /* already closed */
    }
    pageClient = null
    return json({ error: String(error?.message ?? error) }, 502)
  }
}

async function launchRoute() {
  try {
    await ensureChrome()
    return statusRoute()
  } catch (error) {
    return json({ running: false, error: String(error?.message ?? error) }, 500)
  }
}

/** Required host service: the authenticated Fetch route registry. */
export const inject = ['connection']

/**
 * Register the mirror routes and bring the integrated browser up.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export async function apply(ctx) {
  const connection = Reflect.get(ctx, 'connection')
  const routes = [
    { path: '/api/browser-use/status', methods: ['GET'], requestBody: 'buffered', fetch: statusRoute },
    { path: '/api/browser-use/frame.jpg', methods: ['GET'], requestBody: 'buffered', fetch: frameRoute },
    { path: '/api/browser-use/launch', methods: ['POST'], requestBody: 'buffered', fetch: launchRoute },
  ]
  const disposers = []
  for (const route of routes) {
    const dispose = connection.fetch.register(route)
    if (typeof dispose === 'function') disposers.push(dispose)
  }
  ctx.effect(
    () => () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          /* teardown is best effort */
        }
      }
    },
    'browser-use:routes',
  )
  // Keep the cursor overlay installed even before the mirror tab is opened, so
  // the agent cursor is visible in the real Chrome window too.
  ctx.effect(() => {
    const timer = setInterval(() => {
      ensurePageClient()
        .then((client) => (client ? ensureOverlay(client) : undefined))
        .catch(() => {})
    }, 1500)
    return () => clearInterval(timer)
  }, 'browser-use:overlay-poller')
  ensureChrome().catch((error) => {
    console.warn(`[dsh-browser-use] ${String(error?.message ?? error)}`)
  })
}
