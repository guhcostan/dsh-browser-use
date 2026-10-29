# dsh-browser-use

**Agent-driven browser for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**
A DSH profile bundle that mounts the shared browser-use service with
[Playwright MCP](https://github.com/microsoft/playwright-mcp) tools, so the agent can open a
real browser, navigate, snapshot the page, click, type, manage tabs and take screenshots.

`MIT` · `DSH 0.2.1-rc.3` · `macOS · Linux · Windows`

---

## What you get

| Tool namespace | Capability |
|---|---|
| `mcp__playwright-mcp__browser_*` | navigate, snapshot, click, type, press keys, hover, drag, select, fill forms, upload files, tabs, console/network logs, evaluate JS, screenshots |

The agent gets a dedicated browser per live Session. Nothing is shared between Sessions:
each one launches (or attaches to) its own browser and keeps its own tabs and cookies for
the duration of the session.

## Requirements

- **DeepSeek Harness 0.2.1-rc.3** (desktop app, web profile or any DSH profile that already
  provides tools and a system prompt).
- A **Chromium-based browser**. By default the bundle uses the Chromium shipped with the
  Playwright MCP runtime; to use an installed Google Chrome, Chromium, Edge or Brave, set
  `executablePath` (see [Configuration](#configuration)).

## Install

The supported installation path is the DSH **Plugin Manager**; it installs the bundle,
resolves its dependencies and registers it as a profile bundle layer.

1. Clone this repository somewhere local:

   ```sh
   git clone https://github.com/guhcostan/dsh-browser-use.git
   ```

2. In a DSH session, ask the agent to install the bundle from that absolute path
   (the agent calls `plugin_manager` with `action: install_bundle` and the repository
   directory as `target`). You can also use the Plugins UI if your build exposes local
   bundle installation.

3. Open a **new chat**. Browser tools are mounted per Session; sessions created before the
   bundle activated do not receive them.

> The bundle declares `@deepseek-ai/dsh-browser-use` and
> `@deepseek-ai/dsh-experimental-browser-use-playwright-mcp` as dependencies, so a normal
> install pulls both. Do not mount a second browser-use provider in the same profile: the
> service allows exactly one provider at a time.

## Configuration

The bundle ships a portable default (`mode: launch`, `headless: false`). Override the
provider row in your profile's `cordis.patch.yml`; an override replaces the whole `config`.

**Drive your installed Google Chrome (macOS):**

```yaml
- id: browser-use-playwright-mcp
  name: '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'
  config:
    mode: launch
    headless: false
    executablePath: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

On Windows/Linux, point `executablePath` at your Chrome/Chromium binary, for example
`C:\Program Files\Google\Chrome\Application\chrome.exe` or `/usr/bin/google-chrome`.

**Attach to a browser that is already running** (keeps your logins; the browser must expose
CDP, e.g. Chromium 136+ started with `--remote-debugging-port=9222` **and** an explicit
`--user-data-dir`):

```yaml
- id: browser-use-playwright-mcp
  name: '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'
  config:
    mode: attach
    endpoint: 'http://127.0.0.1:9222'
```

One Session claims the attachment at a time; if it is busy, that Session runs without a
browser and does not retry later.

## Verify

1. Open a new chat and ask something like: *"Open example.com and tell me the page title."*
2. The agent should call `mcp__playwright-mcp__browser_navigate` and
   `mcp__playwright-mcp__browser_snapshot` / `browser_evaluate`.
3. A visible browser window opens (unless you set `headless: true`).

Optional preflight:

```sh
sh scripts/check.sh
```

## How it works

DeepSeek Harness composes a profile from ordered patch layers. This package is a
**configuration-only bundle**: `package.json` declares `dsh.bundle.patch` and
`cordis.patch.yml` inserts two rows — the browser-use seam and the Playwright MCP provider.
The provider starts the pinned Playwright MCP server, exposes its tools to the Session and
owns browser lifecycle. No plugin source code runs from this repository; the runtime comes
from the dependencies.

```
dsh-browser-use/
├── package.json          # dsh.bundle.patch + dependencies + display metadata
├── cordis.patch.yml      # the two rows inserted into the profile
├── locale/{en,zh}.json   # Plugin Manager title/description
├── icon.svg              # bundle icon
└── scripts/check.sh      # local preflight
```

## Version compatibility

DSH prereleases require plugins whose peer dependencies match the running build exactly.
This release is pinned to **0.2.1-rc.3**. When your DSH updates, update the two dependency
versions in `package.json` to the same build (they are published under the `next` npm tag)
and reinstall the bundle. If the versions do not match, the loader refuses the rows and the
browser tools stay unavailable.

## License

[MIT](./LICENSE) © 2026 Gustavo Costa

This bundle wires packages published by DeepSeek. Their licenses and support terms are their
own; this repository contains only the composition, documentation and artwork.
