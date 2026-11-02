import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import type { EmailSummary } from '../jmap/types'
import { Avatar } from './Avatar'
import { cx, shortDate } from '../lib/format'
import { spring } from '../lib/motion'

export function MailList({
  emails, loading, selectedThread, onOpen, onLoadMore, hasMore, search, onSearch, title,
}: {
  emails: EmailSummary[]
  loading: boolean
  selectedThread: string | null
  onOpen: (e: EmailSummary) => void
  onLoadMore: () => void
  hasMore: boolean
  search: string
  onSearch: (v: string) => void
  title: string
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && onLoadMore(), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, onLoadMore])

  return (
    <div className="flex h-full w-full flex-col border-r border-line bg-ink-0 md:w-[360px] md:shrink-0">
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="px-3 pb-2">
        <div className="flex h-8 items-center rounded-lg bg-ink-2 px-3">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search"
            className="w-full text-[13px] placeholder:text-fg-3"
            spellCheck={false}
          />
          {search && (
            <button onClick={() => onSearch('')} className="ml-2 text-[13px] text-fg-3">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {loading && emails.length === 0 && (
          <div className="flex flex-col gap-1 px-1 pt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-[66px] rounded-xl bg-ink-1"
                animate={{ opacity: [0.5, 0.85, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.06 }}
              />
            ))}
          </div>
        )}

        {!loading && emails.length === 0 && (
          <p className="px-3 pt-8 text-[13px] text-fg-3">{search ? 'No matches' : 'Nothing here'}</p>
        )}

        {emails.map((e) => {
          const unread = !e.keywords.$seen
          const active = e.threadId === selectedThread
          const who = e.from[0] ?? e.to[0]
          return (
            <button
              key={e.id}
              onClick={() => onOpen(e)}
              className="relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left"
            >
              {active && <motion.span layoutId="row-active" transition={spring} className="absolute inset-0 rounded-xl bg-ink-2" />}
              <span className="relative pt-0.5">
                <Avatar who={who} />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cx('min-w-0 flex-1 truncate text-[13px]', unread ? 'font-semibold text-fg' : 'text-fg-2')}>
                    {who?.name || who?.email || 'Unknown'}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-fg-3">{shortDate(e.receivedAt)}</span>
                </span>
                <span className={cx('mt-0.5 block truncate text-[13px]', unread ? 'text-fg' : 'text-fg-2')}>
                  {e.subject || '(no subject)'}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-fg-3">{e.preview}</span>
              </span>
              {unread && <span className="relative mt-2 size-[6px] shrink-0 rounded-full bg-white" />}
            </button>
          )
        })}
        <div ref={sentinel} />
      </div>
    </div>
  )
}
