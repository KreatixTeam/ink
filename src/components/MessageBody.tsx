import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'

const RICH = `
  <style>
    html,body { margin:0; padding:0; background:#fff; color:#111; }
    body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; word-break: break-word; }
    img { max-width:100% !important; height:auto; }
    table { max-width:100% !important; }
  </style>
`

const isRich = (html: string) => /bgcolor|background(-color)?\s*:|<table|color\s*:\s*#[0-9a-f]{3}/i.test(html)

const STYLE = `
  <style>
    :root { color-scheme: dark; }
    html,body { margin:0; padding:0; background:transparent; }
    body {
      color:#e8e8ea; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      word-break: break-word; -webkit-font-smoothing: antialiased;
    }
    a { color:#8ab4ff; }
    img { max-width:100% !important; height:auto; border-radius:6px; }
    table { max-width:100% !important; }
    blockquote { margin:0 0 0 .6em; padding-left:.9em; border-left:2px solid rgba(255,255,255,.14); color:#a1a1aa; }
    pre,code { font-family: ui-monospace, Menlo, monospace; font-size:12.5px; }
    pre { overflow:auto; background:rgba(255,255,255,.05); padding:10px; border-radius:8px; }
    * { background-color: transparent !important; }
  </style>
`

export function MessageBody({ html, text }: { html: string | null; text: string | null }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(0)
  const rich = !!html && isRich(html)

  const doc = useMemo(() => {
    if (html) {
      const clean = DOMPurify.sanitize(html, {
        FORBID_TAGS: ['style', 'script', 'form', 'input', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['srcset', 'background'],
      })
      return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${rich ? RICH : STYLE}</head><body>${clean}</body></html>`
    }
    const escaped = (text ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
    const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${STYLE}</head><body><div style="white-space:pre-wrap">${linked}</div></body></html>`
  }, [html, text, rich])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    frame.srcdoc = doc
    const measure = () => {
      const h = frame.contentDocument?.documentElement?.scrollHeight
      if (h) setHeight(h)
    }
    let ro: ResizeObserver | undefined
    const onLoad = () => {
      measure()
      const d = frame.contentDocument
      if (!d) return
      ro = new ResizeObserver(measure)
      ro.observe(d.documentElement)
      d.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure))
    }
    frame.addEventListener('load', onLoad)
    return () => {
      frame.removeEventListener('load', onLoad)
      ro?.disconnect()
    }
  }, [doc])

  return (
    <iframe
      ref={ref}
      title="message"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className={rich ? 'w-full rounded-xl border-0 bg-white' : 'w-full border-0'}
      style={{ height: height || 120 }}
    />
  )
}
