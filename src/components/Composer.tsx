import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { JmapClient } from '../jmap/client'
import type { EmailFull, Identity } from '../jmap/types'
import { formatAddress, parseAddressList } from '../jmap/address'
import { bytes, cx } from '../lib/format'
import { fade, spring } from '../lib/motion'

export type Draft =
  | { mode: 'new' }
  | { mode: 'reply'; source: EmailFull; all: boolean }

interface Upload { blobId: string; name: string; type: string; size: number }

function initial(d: Draft, me: string) {
  if (d.mode === 'new') return { to: '', cc: '', subject: '', body: '' }
  const s = d.source
  const replyTo = s.replyTo?.length ? s.replyTo : s.from
  const others = d.all ? [...s.to, ...s.cc].filter((a) => a.email.toLowerCase() !== me.toLowerCase()) : []
  const quoted = (s.text ?? s.preview ?? '').split('\n').map((l) => `> ${l}`).join('\n')
  const who = s.from[0] ? formatAddress(s.from[0]) : ''
  return {
    to: replyTo.map(formatAddress).join(', '),
    cc: others.map(formatAddress).join(', '),
    subject: /^re:/i.test(s.subject) ? s.subject : `Re: ${s.subject}`,
    body: `\n\nOn ${new Date(s.receivedAt).toLocaleString()}, ${who} wrote:\n${quoted}`,
  }
}

export function Composer({
  draft, client, identities, onClose, onSent,
}: {
  draft: Draft
  client: JmapClient
  identities: Identity[]
  onClose: () => void
  onSent: () => void
}) {
  const identity = identities.find((i) => i.email.toLowerCase() === client.username.toLowerCase()) ?? identities[0]
  const init = initial(draft, identity?.email ?? client.username)
  const [to, setTo] = useState(init.to)
  const [cc, setCc] = useState(init.cc)
  const [showCc, setShowCc] = useState(!!init.cc)
  const [subject, setSubject] = useState(init.subject)
  const [body, setBody] = useState(init.body)
  const [files, setFiles] = useState<Upload[]>([])
  const [uploading, setUploading] = useState(0)
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function addFiles(list: FileList | null) {
    if (!list) return
    for (const f of Array.from(list)) {
      setUploading((n) => n + 1)
      try {
        const r = await client.upload(f)
        setFiles((prev) => [...prev, { blobId: r.blobId, name: f.name, type: f.type || r.type, size: f.size }])
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function send() {
    const toList = parseAddressList(to)
    if (!toList.length || state === 'sending' || uploading) return
    if (!identity) {
      setState('error')
      setError('No sending identity on this account')
      return
    }
    setState('sending')
    try {
      const src = draft.mode === 'reply' ? draft.source : null
      await client.send({
        identityId: identity.id,
        from: { name: identity.name || null, email: identity.email },
        to: toList,
        cc: parseAddressList(cc),
        subject,
        text: body,
        attachments: files,
        inReplyTo: src?.messageId ?? undefined,
        references: src ? [...(src.references ?? []), ...(src.messageId ?? [])] : undefined,
      })
      onSent()
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : 'Send failed')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.98 }}
      transition={spring}
      className="fixed inset-0 z-40 flex flex-col bg-ink-1 md:inset-auto md:bottom-4 md:right-4 md:h-[min(620px,calc(100vh-32px))] md:w-[560px] md:rounded-2xl md:border md:border-line-strong md:shadow-[0_30px_80px_rgba(0,0,0,.8)]"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
        <span className="text-[13px] font-medium">{draft.mode === 'reply' ? 'Reply' : 'New message'}</span>
        <button onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-fg-2 hover:bg-ink-3">
          Discard
        </button>
      </div>

      <Row label="To">
        <input autoFocus={draft.mode === 'new'} value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1" spellCheck={false} />
        {!showCc && (
          <button onClick={() => setShowCc(true)} className="text-[12px] text-fg-3 hover:text-fg-2">
            Cc
          </button>
        )}
      </Row>
      <AnimatePresence initial={false}>
        {showCc && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={spring} className="overflow-hidden">
            <Row label="Cc">
              <input value={cc} onChange={(e) => setCc(e.target.value)} className="min-w-0 flex-1" spellCheck={false} />
            </Row>
          </motion.div>
        )}
      </AnimatePresence>
      <Row label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="min-w-0 flex-1" />
      </Row>

      <textarea
        autoFocus={draft.mode === 'reply'}
        ref={(el) => {
          if (el && draft.mode === 'reply' && el.selectionStart === el.value.length && document.activeElement === el) el.setSelectionRange(0, 0)
        }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-0 flex-1 resize-none px-4 py-3 leading-relaxed"
      />

      {(files.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {files.map((f) => (
            <span key={f.blobId} className="flex items-center gap-2 rounded-lg border border-line bg-ink-2 px-2.5 py-1.5 text-[12px]">
              <span className="max-w-[160px] truncate">{f.name}</span>
              <span className="text-fg-3">{bytes(f.size)}</span>
              <button onClick={() => setFiles((p) => p.filter((x) => x.blobId !== f.blobId))} className="text-fg-3 hover:text-fg">
                Remove
              </button>
            </span>
          ))}
          {uploading > 0 && <span className="px-1 py-1.5 text-[12px] text-fg-3">Uploading</span>}
        </div>
      )}

      <div className="flex h-14 shrink-0 items-center gap-2 border-t border-line px-3 pb-[env(safe-area-inset-bottom)]">
        <motion.button
          onClick={send}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className={cx(
            'h-9 rounded-xl bg-white px-5 text-[13px] font-medium text-black transition-opacity',
            (!parseAddressList(to).length || uploading > 0) && 'opacity-40',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
              {state === 'sending' ? 'Sending' : 'Send'}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <button onClick={() => fileInput.current?.click()} className="rounded-lg px-3 py-2 text-[12.5px] text-fg-2 hover:bg-ink-3">
          Attach
        </button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <span className="ml-auto hidden text-[11px] text-fg-3 md:block">⌘ Enter</span>
        <AnimatePresence>
          {state === 'error' && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-2 truncate text-[12px] text-danger">
              {error}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-4">
      <span className="w-[52px] shrink-0 text-[12.5px] text-fg-3">{label}</span>
      {children}
    </label>
  )
}
