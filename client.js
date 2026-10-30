window.__ModuleLoader__.load({
  id: '@guhcostan/dsh-browser-use',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const TYPE_ID = '@guhcostan/dsh-browser-use'
    const KIND = 'browser-use-mirror'
    const STATUS_URL = '/api/browser-use/status'
    const FRAME_URL = '/api/browser-use/frame.jpg'
    const LAUNCH_URL = '/api/browser-use/launch'
    const FRAME_INTERVAL_MS = 80
    const STATUS_INTERVAL_MS = 2500

    let t = (key) => key
    let sidebarRight = null

    const en = {
      'type.label': 'Browser use',
      'guide.title': 'Browser use',
      'guide.description': 'Watch the agent drive the integrated browser',
      'empty.title': 'No browser running',
      'empty.body': 'Start the integrated Chrome and the agent’s browser appears here live.',
      'action.launch': 'Open browser',
      'action.refresh': 'Refresh',
      'action.zoomIn': 'Zoom in',
      'action.zoomOut': 'Zoom out',
      'action.fit': 'Fit to pane',
      'action.fullscreen': 'Toggle fullscreen',
      'status.connecting': 'Connecting to the browser…',
      'status.error': 'Could not read the browser status',
      'badge.agent': 'agent in control',
      'aria.mirror': 'Integrated browser mirror',
    }

    const zh = {
      'type.label': '浏览器使用',
      'guide.title': '浏览器使用',
      'guide.description': '观看智能体操作集成浏览器',
      'empty.title': '浏览器未运行',
      'empty.body': '启动集成 Chrome 后，智能体操作的页面会实时显示在这里。',
      'action.launch': '打开浏览器',
      'action.refresh': '刷新',
      'action.zoomIn': '放大',
      'action.zoomOut': '缩小',
      'action.fit': '适应宽度',
      'action.fullscreen': '全屏切换',
      'status.connecting': '正在连接浏览器…',
      'status.error': '无法读取浏览器状态',
      'badge.agent': '智能体控制中',
      'aria.mirror': '集成浏览器镜像',
    }

    const styles = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--dsw-alias-bg-l1, #141414)',
        color: 'var(--dsw-alias-label-secondary, #b8b8b8)',
        font: '12px/1.4 var(--dsw-font-sans, system-ui, sans-serif)',
      },
      header: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '7px 10px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.10))',
      },
      headerMain: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
      headerRow: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 },
      dot: { width: 7, height: 7, borderRadius: '50%', flex: 'none' },
      title: {
        color: 'var(--dsw-alias-label-primary, #f2f2f2)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      badge: {
        flex: 'none',
        padding: '1px 6px',
        borderRadius: 999,
        border: '0.5px solid rgba(255,47,208,0.55)',
        color: '#ff6fdd',
        fontSize: 10,
        lineHeight: '15px',
      },
      url: {
        color: 'var(--dsw-alias-label-tertiary, #8a8a8a)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 420,
      },
      iconButton: {
        flex: 'none',
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.14))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary, #c8c8c8)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
      },
      controls: { flex: 'none', display: 'flex', alignItems: 'center', gap: 4 },
      zoomLabel: {
        flex: 'none',
        minWidth: 34,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.14))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary, #8a8a8a)',
        cursor: 'pointer',
        fontSize: 10,
        lineHeight: 1,
      },
      stage: {
        position: 'relative',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#0a0a0a',
      },
      image: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: '#0a0a0a',
      },
      imageZoomed: {
        display: 'block',
        height: 'auto',
        maxWidth: 'none',
        background: '#0a0a0a',
      },
      stageZoomed: {
        position: 'relative',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'block',
        overflow: 'auto',
        background: '#0a0a0a',
      },
      placeholder: {
        color: 'var(--dsw-alias-label-tertiary, #8a8a8a)',
        padding: 20,
        textAlign: 'center',
      },
      empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 24,
        textAlign: 'center',
        maxWidth: 340,
      },
      emptyTitle: {
        color: 'var(--dsw-alias-label-primary, #f2f2f2)',
        fontSize: 13,
        fontWeight: 600,
      },
      emptyBody: { color: 'var(--dsw-alias-label-tertiary, #8a8a8a)', fontSize: 12 },
      primary: {
        marginTop: 4,
        padding: '6px 12px',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.18))',
        background: 'var(--dsw-alias-fill-l2, rgba(255,255,255,0.10))',
        color: 'var(--dsw-alias-label-primary, #f2f2f2)',
        cursor: 'pointer',
        fontSize: 12,
      },
    }

    /** Guide glyph: a window with an agent pointer. */
    function BrowserGlyph() {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: 18,
          height: 18,
          fill: 'none',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('rect', {
          x: 2.5,
          y: 4.5,
          width: 19,
          height: 15,
          rx: 2.4,
          stroke: 'currentColor',
          strokeWidth: 1.6,
        }),
        h('path', { d: 'M2.5 8.5h19', stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', {
          d: 'M11 11.2l5.4 3.9-2.8.5-.9 2.7z',
          fill: 'currentColor',
          stroke: 'none',
        }),
      )
    }

    function BrowserBody() {
      const [status, setStatus] = useState({
        loading: true,
        running: false,
        page: null,
        error: null,
      })
      const [frame, setFrame] = useState(null)
      const [busy, setBusy] = useState(false)
      const [refresh, setRefresh] = useState(0)
      const [zoom, setZoom] = useState(1)
      const rootRef = useRef(null)

      useEffect(() => {
        let cancelled = false
        const load = async () => {
          try {
            const response = await fetch(STATUS_URL, {
              headers: { accept: 'application/json' },
              cache: 'no-store',
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            const data = await response.json()
            if (cancelled) return
            setStatus({
              loading: false,
              running: Boolean(data.running),
              page: data.page ?? null,
              error: null,
            })
          } catch (error) {
            if (cancelled) return
            setStatus((previous) => ({
              ...previous,
              loading: false,
              error: String((error && error.message) || error),
            }))
          }
        }
        load()
        const timer = setInterval(load, STATUS_INTERVAL_MS)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [refresh])

      const watching = status.running && status.page

      useEffect(() => {
        setFrame(null)
        if (!status.running) return
        let cancelled = false
        let timer = null
        const pump = () => {
          if (cancelled) return
          const next = FRAME_URL + '?t=' + Date.now()
          const image = new Image()
          image.onload = () => {
            if (cancelled) return
            setFrame(next)
            timer = setTimeout(pump, FRAME_INTERVAL_MS)
          }
          image.onerror = () => {
            if (cancelled) return
            timer = setTimeout(pump, 900)
          }
          image.src = next
        }
        pump()
        return () => {
          cancelled = true
          if (timer) clearTimeout(timer)
        }
      }, [status.running, status.page ? status.page.url : null])

      const launch = async () => {
        setBusy(true)
        try {
          await fetch(LAUNCH_URL, { method: 'POST' })
          setRefresh((value) => value + 1)
        } catch {
          /* the status poll reports the failure state */
        } finally {
          setBusy(false)
        }
      }

      const toggleFullscreen = () => {
        try {
          const target =
            sidebarRight?.focusedTarget?.(rootRef.current) ??
            sidebarRight?.commandTarget?.(rootRef.current)
          if (target) sidebarRight.toggleFullscreen(target)
        } catch {
          /* the panel keeps its own fullscreen control as fallback */
        }
      }

      const connecting = !frame && (status.loading || (status.running && status.page))

      return h(
        'div',
        { ref: rootRef, style: styles.root },
        h(
          'div',
          { style: styles.header },
          h(
            'div',
            { style: styles.headerMain },
            h(
              'div',
              { style: styles.headerRow },
              h('span', {
                style: {
                  ...styles.dot,
                  background: status.running ? '#3fb950' : 'var(--dsw-alias-label-tertiary, #8a8a8a)',
                },
              }),
              h(
                'span',
                { style: styles.title },
                status.page && status.page.title
                  ? status.page.title
                  : status.running
                    ? t('type.label')
                    : t('empty.title'),
              ),
              status.running ? h('span', { style: styles.badge }, t('badge.agent')) : null,
            ),
            status.page && status.page.url
              ? h('span', { style: styles.url }, status.page.url)
              : null,
          ),
          h(
            'div',
            { style: styles.controls },
            h('button', {
              type: 'button',
              style: styles.iconButton,
              title: t('action.zoomOut'),
              'aria-label': t('action.zoomOut'),
              onClick: () => setZoom((value) => Math.max(1, Math.round((value - 0.5) * 10) / 10)),
            }, '−'),
            h('button', {
              type: 'button',
              style: styles.zoomLabel,
              title: t('action.fit'),
              'aria-label': t('action.fit'),
              onClick: () => setZoom(1),
            }, zoom === 1 ? 'Fit' : Math.round(zoom * 100) + '%'),
            h('button', {
              type: 'button',
              style: styles.iconButton,
              title: t('action.zoomIn'),
              'aria-label': t('action.zoomIn'),
              onClick: () => setZoom((value) => Math.min(4, Math.round((value + 0.5) * 10) / 10)),
            }, '+'),
            h('button', {
              type: 'button',
              style: styles.iconButton,
              title: t('action.fullscreen'),
              'aria-label': t('action.fullscreen'),
              onClick: toggleFullscreen,
            }, '⛶'),
            h('button', {
              type: 'button',
              style: styles.iconButton,
              title: t('action.refresh'),
              'aria-label': t('action.refresh'),
              onClick: () => setRefresh((value) => value + 1),
            }, '↻'),
          ),
        ),
        h(
          'div',
          { style: zoom > 1 ? styles.stageZoomed : styles.stage },
          frame
            ? h('img', {
                key: frame,
                src: frame,
                alt: t('aria.mirror'),
                draggable: false,
                onDoubleClick: () => setZoom((value) => (value > 1 ? 1 : 2)),
                style:
                  zoom > 1
                    ? { ...styles.imageZoomed, width: Math.round(zoom * 100) + '%' }
                    : styles.image,
              })
            : connecting
              ? h('div', { style: styles.placeholder }, t('status.connecting'))
              : h(
                  'div',
                  { style: styles.empty },
                  h('div', { style: styles.emptyTitle }, t('empty.title')),
                  h(
                    'div',
                    { style: styles.emptyBody },
                    status.error ? t('status.error') + ': ' + status.error : t('empty.body'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      style: styles.primary,
                      disabled: busy,
                      onClick: launch,
                    },
                    busy ? '…' : t('action.launch'),
                  ),
                ),
        ),
      )
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

    function apply(ctx) {
      const namespace = 'browserUseMirror'
      t = ctx.locale.bind(namespace)
      sidebarRight = ctx.sidebarRight

      ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'browser-use:copy')

      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: TYPE_ID,
            kind: KIND,
            title: () => t('type.label'),
            guide: [
              {
                id: 'integrated-browser',
                order: 34,
                title: () => t('guide.title'),
                description: () => t('guide.description'),
                icon: BrowserGlyph,
              },
            ],
          }),
        'browser-use:type',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: TYPE_ID },
              BrowserBody,
            ),
          ),
        'browser-use:body',
      )
    }

    return { inject, apply }
  },
})
