import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { EmailFull } from '../jmap/types'
import type { JmapClient } from '../jmap/client'
import { Avatar } from './Avatar'
import { MessageBody } from './MessageBody'
import { bytes, cx, longDate } from '../lib/format'
import { fade, spring } from '../lib/motion'

export function Thread({
  thread, client, onReply, onArchive, onDelete, onBack, canArchive,
}: {
  thread: EmailFull[] | null
  client: JmapClient
  onReply: (m: EmailFull, all: boolean) => void
  onArchive: () => void
  onDelete: () => void
  onBack: () => void
  canArchive: boolean
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const scroller = useRef<HTMLDivElement>(null)
  const last = thread?.[thread.length - 1]

  const threadKey = thread?.[0]?.threadId
  useEffect(() => {
    if (threadKey) scroller.current?.scrollTo({ top: 0 })
  }, [threadKey])

  if (!thread) return <div className="flex-1 bg-ink-0" />

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-ink-0">
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-3">
        <button onClick={onBack} className="mr-1 rounded-lg px-2 py-1 text-[13px] text-fg-2 md:hidden">
          Back
        </button>
        <h2 className="min-w-0 flex-1 truncate px-2 text-[14px] font-medium">{thread[0]?.subject || '(no subject)'}</h2>
        {last && <Action onClick={() => onReply(last, false)}>Reply</Action>}
        {last && last.to.length + last.cc.length > 1 && <Action onClick={() => onReply(last, true)}>Reply all</Action>}
        {canArchive && <Action onClick={onArchive}>Archive</Action>}
        <Action onClick={onDelete} danger>
          Delete
        </Action>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-5 py-5">
          {thread.map((m, i) => {
            const isLast = i === thread.length - 1
            const expanded = open[m.id] ?? isLast
            return (
              <motion.div
                key={m.id}
                layout
                transition={spring}
                className={cx('mb-3 overflow-hidden rounded-2xl border border-line', expanded ? 'bg-ink-1' : 'bg-ink-0')}
              >
                <button
                  onClick={() => setOpen((o) => ({ ...o, [m.id]: !expanded }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <Avatar who={m.from[0]} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium">{m.from[0]?.name || m.from[0]?.email}</span>
                      <span className="shrink-0 text-[11px] text-fg-3">{longDate(m.receivedAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-fg-3">
                      {expanded ? `to ${m.to.map((t) => t.name || t.email).join(', ')}` : m.preview}
                    </span>
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <MessageBody html={m.html} text={m.text} />
                        {m.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.attachments.map((a) => (
                              <AttachmentChip key={a.blobId} client={client} att={a} />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Action({ children, onClick, danger }: { children: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={cx('rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-ink-2', danger ? 'text-danger' : 'text-fg-2')}
    >
      {children}
    </motion.button>
  )
}

function AttachmentChip({ client, att }: { client: JmapClient; att: { blobId: string; name: string | null; type: string; size: number } }) {
  const [busy, setBusy] = useState(false)
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={spring}
      onClick={async () => {
        setBusy(true)
        try {
          const blob = await client.fetchBlob(att.blobId, att.name ?? 'attachment', att.type)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = att.name ?? 'attachment'
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
        } finally {
          setBusy(false)
        }
      }}
      className="flex max-w-[240px] items-center gap-2 rounded-lg border border-line bg-ink-2 px-3 py-2"
    >
      <span className="min-w-0 flex-1 truncate text-left text-[12.5px]">{att.name ?? 'attachment'}</span>
      <motion.span animate={{ opacity: busy ? 0.4 : 1 }} transition={fade} className="shrink-0 text-[11px] text-fg-3">
        {bytes(att.size)}
      </motion.span>
    </motion.button>
  )
}
