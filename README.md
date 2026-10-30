# dsh-browser-use

[![CI](https://github.com/guhcostan/dsh-browser-use/actions/workflows/ci.yml/badge.svg)](https://github.com/guhcostan/dsh-browser-use/actions/workflows/ci.yml)

**Integrated browser for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**
The agent drives a real Chrome; you **watch it live in the right Sidebar** — and you can see the
**agent cursor** move and click inside the page, like a pair-programming session with the browser.

`MIT` · `DSH 0.2.1-rc.3` · `macOS · Linux · Windows`

---

## What you get

| Piece | What it does |
|---|---|
| **Agent browser tools** | The Playwright MCP provider attached to a dedicated Chrome: `mcp__playwright-mcp__browser_*` (navigate, snapshot, click, type, tabs, network, screenshots, …) |
| **“Browser use” tab** (right Sidebar) | A live mirror of the very page the agent controls, with status, page title/URL and a refresh control. Opened from the right Sidebar guide. |
| **Agent cursor** | An overlay injected into the page: a magenta pointer with an “Agent” badge follows the agent’s pointer and pulses on every click. It shows in the integrated mirror **and** in the real Chrome window. |
| **Open browser** | The launcher starts the dedicated Chrome (CDP on `127.0.0.1:9223`) automatically at profile boot; the tab also has a button to relaunch it. |
| **Zoom & fullscreen** | `−` / `Fit` or `100–400%` / `+` controls in the tab header; double-click the frame to toggle Fit ↔ 200%; a fullscreen button toggles the panel presentation. Zoomed frames pan/scroll inside the pane so you can read a narrow panel. |

Because the mirror and the agent share one Chrome over CDP, what you see is exactly what the
agent sees — no second browser, no replayed screenshots from a different session.

## Requirements

- **DeepSeek Harness 0.2.1-rc.3** (web or desktop profile).
- **Google Chrome / Chromium installed.** The launcher searches the usual macOS/Windows/Linux
  paths. Override with the `DSH_BROWSER_USE_CHROME` environment variable (absolute binary path).
- **Port `9223` free** on `127.0.0.1` (the launcher refuses to start a second CDP browser and
  reuses a running one).

## Install

The supported path is the DSH **Plugin Manager**:

1. Clone the repository:

   ```sh
   git clone https://github.com/guhcostan/dsh-browser-use.git
   ```

2. In a DSH session, ask the agent to install the bundle from that absolute path
   (`plugin_manager` with `action: install_bundle` and the repository directory as `target`).

3. **Reload the Web UI** (or restart the app) so the Client half loads. Then open the right
   Sidebar guide (compass) and pick **Browser use**.

> **npm:** the package is published as `@guhcostan/dsh-browser-use`. Once the npm release is
> live you can install it by name:
>
> ```
> plugin_manager install_bundle target=@guhcostan/dsh-browser-use@0.2.1
> ```

> One browser-use provider per profile. This bundle mounts the seam plus the Playwright MCP
> provider in `attach` mode; do not add a second `browser-use` provider.

## Use

1. Right Sidebar → guide → **Browser use**. The launcher starts Chrome with a dedicated profile
   (`~/.dsh/browser-use/chrome-profile`) the first time.
2. Ask the agent anything browser-related, e.g. *“open news.ycombinator.com and click the first
   story”*. The mirror shows the page in real time; the magenta cursor and its pulse show what
   the agent is doing.
3. The panel is **view-only** for humans; input belongs to the agent’s tools.
4. Header controls: `−` / zoom label (`Fit` = whole page, percentages = scrollable zoom, up to 400%) / `+`, `⛶` fullscreen, `↻` refresh. Double-clicking the frame toggles Fit ↔ 200%.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DSH_BROWSER_USE_CHROME` | auto-discovered | Absolute path to a Chrome/Chromium/Edge/Brave binary |
| — | `127.0.0.1:9223` | CDP endpoint (fixed; the provider attaches here) |
| — | `~/.dsh/browser-use/chrome-profile` | Dedicated Chrome profile (no personal logins) |

The dedicated profile is deliberate: the agent must not drive your daily browser profile.
If you need to be logged in somewhere, log in once inside the integrated browser (the profile
persists between runs).

## How it works

```
dsh-browser-use/
├── package.json          # dsh.bundle.patch + dsh.client manifest + display metadata
├── cordis.patch.yml      # launcher row, browser-use seam, Playwright MCP provider (attach)
├── index.js              # Host: Chrome launcher, CDP mirror routes, agent-cursor injection
├── client.js             # Client: right-Sidebar tab type + guide entry + mirror UI
├── locale/{en,zh}.json   # Plugin Manager title/description
├── icon.svg              # bundle icon
└── scripts/check.sh      # Chrome / port preflight
```

- **Launcher (Host)** — starts a dedicated Chrome with `--remote-debugging-port=9223` and a
  dedicated `--user-data-dir`, then waits for the CDP endpoint.
- **Provider** — `@deepseek-ai/dsh-experimental-browser-use-playwright-mcp` in `mode: attach`
  to `http://127.0.0.1:9223`, so every agent browser tool acts on that Chrome.
- **Mirror (Host)** — `GET /api/browser-use/frame.jpg` captures the current page through
  `Page.captureScreenshot` (JPEG), `GET /api/browser-use/status` reports page title/URL, and
  `POST /api/browser-use/launch` (re)starts Chrome. Routes are registered through DSH's
  authenticated `connection.fetch` registry, so only the local app session can read them.
- **Agent cursor** — a shadow-DOM overlay injected into every document
  (`Page.addScriptToEvaluateOnNewDocument`): it listens to pointer events/text, follows the
  pointer and pulses on click. Because it lives in the page, it appears in the mirror *and*
  in the real Chrome window.
- **Tab (Client)** — a page tab type registered through `ctx.sidebarRightTabs` (id
  `dsh-browser-use`, kind `browser-use-mirror`) with a body in `sidebar.right.pane.tab`; it
  polls status and pumps frames through an `Image` preload.

## Limitations

- **View-only mirror** — clicking the panel does not control the browser; the agent does.
- **Cursor is per top-level document** — clicks inside cross-origin iframes are not drawn
  (the overlay sees the main frame's events only).
- **One attached session** — the Playwright MCP provider claims the attachment per Session;
  other Sessions run without a browser while it is busy.
- **Dedicated profile only** — the integrated browser does not reuse your daily Chrome
  profile or its logins.
- **JPEG frames at ~10 fps** — a mirror, not a video stream; animations can look choppy.
- **Loopback CDP** — Chrome exposes its DevTools protocol on `127.0.0.1:9223` while it runs.
  Any local process can connect to it, as with any CDP browser; close Chrome when you do not
  need it.

## Troubleshooting

- **The tab stays on “Connecting…”** — check `curl http://127.0.0.1:9223/json/version`. If it
  fails, press **Open browser** or set `DSH_BROWSER_USE_CHROME`. After an in-place update of the
  plugin, toggle it in the Plugin Manager (or restart DSH) so the new Host module loads.
- **Port 9223 busy** — another process owns it; quit that browser or change the constant in
  `index.js` (and the patch endpoint) before reinstalling.
- **The guide has no “Browser use” card** — reload the Web UI so the Client half loads.
- **Chrome opens but the agent has no browser tools** — the Playwright MCP provider attaches at
  Session creation; open a **new chat** after the launcher is up.

## Version compatibility

DSH prereleases require plugins whose dependencies match the running build exactly. This
release is pinned to **0.2.1-rc.3**. When your DSH updates, update the two
`@deepseek-ai/dsh-*` dependencies in `package.json` to the same build and reinstall the bundle.

## License

[MIT](./LICENSE) © 2026 Gustavo Costa

This bundle wires packages published by DeepSeek and uses Playwright MCP and Chrome. Those
projects keep their own licenses and support terms; this repository contains the composition,
launcher, mirror routes, cursor overlay, tab UI, documentation and artwork.
