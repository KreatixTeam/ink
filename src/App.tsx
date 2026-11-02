import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SessionProvider, useSession } from './state/session'
import { mailboxLabel, useEmailList, useIdentities, useMailboxes, usePush, useThread } from './state/mail'
import { Login } from './components/Login'
import { Sidebar } from './components/Sidebar'
import { MailList } from './components/MailList'
import { Thread } from './components/Thread'
import { Composer, type Draft } from './components/Composer'
import type { JmapClient } from './jmap/client'
import type { EmailSummary } from './jmap/types'
import { spring } from './lib/motion'

export default function App() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  )
}

function Root() {
  const { status, client } = useSession()
  if (status === 'booting') return <div className="h-full bg-black" />
  if (status === 'signed-out' || !client) return <Login />
  return <Mail client={client} />
}

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

function Mail({ client }: { client: JmapClient }) {
  const { signOut } = useSession()
  const tick = usePush(client)
  const [mailboxes] = useMailboxes(client, tick)
  const identities = useIdentities(client)
  const [mailboxId, setMailboxId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const query = useDebounced(search.trim(), 220)

  const byRole = useMemo(() => Object.fromEntries(mailboxes.filter((m) => m.role).map((m) => [m.role!, m])), [mailboxes])
  useEffect(() => {
    if (!mailboxId && byRole.inbox) setMailboxId(byRole.inbox.id)
  }, [byRole, mailboxId])

  const list = useEmailList(client, mailboxId, query, tick)
  const thread = useThread(client, threadId, tick)
  const current = mailboxes.find((m) => m.id === mailboxId)

  const flash = useCallback((t: string) => {
    setToast(t)
    setTimeout(() => setToast((c) => (c === t ? null : c)), 1800)
  }, [])

  const open = useCallback(
    (e: EmailSummary) => {
      setThreadId(e.threadId)
      if (!e.keywords.$seen) {
        list.setEmails((p) => p.map((x) => (x.id === e.id ? { ...x, keywords: { ...x.keywords, $seen: true } } : x)))
        client.setKeyword([e.id], '$seen', true).catch(() => {})
      }
    },
    [client, list],
  )

  const removeCurrent = useCallback(
    async (to: 'archive' | 'trash') => {
      if (!thread || !mailboxId) return
      const target = byRole[to]
      const ids = thread.filter((m) => m.mailboxIds[mailboxId]).map((m) => m.id)
      const idx = list.emails.findIndex((e) => e.threadId === threadId)
      const next = list.emails[idx + 1] ?? list.emails[idx - 1]
      list.setEmails((p) => p.filter((e) => e.threadId !== threadId))
      setThreadId(next && window.innerWidth >= 768 ? next.threadId : null)
      try {
        if (to === 'trash' && (current?.role === 'trash' || !target)) await client.destroyEmails(ids)
        else if (target) await client.moveEmails(ids, mailboxId, target.id)
        flash(to === 'archive' ? 'Archived' : 'Deleted')
      } catch {
        flash('That did not work')
      }
    },
    [thread, mailboxId, byRole, list, threadId, current, client, flash],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (draft || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return
      const idx = list.emails.findIndex((x) => x.threadId === threadId)
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const n = list.emails[idx + 1]
        if (n) open(n)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        const n = list.emails[idx - 1]
        if (n) open(n)
      } else if (e.key === 'c') {
        e.preventDefault()
        setDraft({ mode: 'new' })
      } else if (e.key === 'r' && thread) {
        e.preventDefault()
        setDraft({ mode: 'reply', source: thread[thread.length - 1], all: false })
      } else if (e.key === 'e' && thread && byRole.archive) removeCurrent('archive')
      else if (e.key === '#' && thread) removeCurrent('trash')
      else if (e.key === 'Escape') setThreadId(null)
      else if (e.key === '/') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[placeholder="Search"]')?.focus()
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, list.emails, threadId, thread, open, byRole, removeCurrent])

  return (
    <div className="flex h-full overflow-hidden bg-black">
      <div className="hidden lg:block">
        <Sidebar
          mailboxes={mailboxes}
          selected={query ? null : mailboxId}
          onSelect={(id) => {
            setSearch('')
            setMailboxId(id)
            setThreadId(null)
          }}
          onCompose={() => setDraft({ mode: 'new' })}
          account={client.username}
          onSignOut={signOut}
        />
      </div>

      <div className={threadId ? 'hidden md:flex' : 'flex w-full md:w-auto'}>
        <div className="flex h-full w-full flex-col md:w-auto">
          <MobileTabs
            mailboxes={mailboxes}
            selected={mailboxId}
            onSelect={(id) => {
              setSearch('')
              setMailboxId(id)
            }}
            onCompose={() => setDraft({ mode: 'new' })}
          />
          <div className="min-h-0 flex-1">
            <MailList
              emails={list.emails}
              loading={list.loading}
              selectedThread={threadId}
              onOpen={open}
              onLoadMore={list.loadMore}
              hasMore={list.emails.length < list.total}
              search={search}
              onSearch={setSearch}
              title={query ? 'Search' : current ? mailboxLabel(current) : ''}
            />
          </div>
        </div>
      </div>

      <div className={threadId ? 'flex min-w-0 flex-1' : 'hidden min-w-0 flex-1 md:flex'}>
        {threadId ? (
          <motion.div key={threadId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={spring} className="flex min-w-0 flex-1">
            <Thread
              thread={thread}
              client={client}
              onReply={(m, all) => setDraft({ mode: 'reply', source: m, all })}
              onArchive={() => removeCurrent('archive')}
              onDelete={() => removeCurrent('trash')}
              onBack={() => setThreadId(null)}
              canArchive={!!byRole.archive && current?.role !== 'archive'}
            />
          </motion.div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="size-2 rounded-full bg-ink-4" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {draft && (
          <Composer
            key={draft.mode === 'reply' ? draft.source.id : 'new'}
            draft={draft}
            client={client}
            identities={identities}
            onClose={() => setDraft(null)}
            onSent={() => {
              setDraft(null)
              flash('Sent')
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={spring}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line-strong bg-ink-2 px-4 py-2 text-[13px]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileTabs({
  mailboxes, selected, onSelect, onCompose,
}: {
  mailboxes: { id: string; name: string; role: string | null; unreadEmails: number; sortOrder: number; parentId: string | null; totalEmails: number; totalThreads: number; unreadThreads: number }[]
  selected: string | null
  onSelect: (id: string) => void
  onCompose: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 py-2 no-scrollbar lg:hidden">
      {mailboxes.map((m) => (
        <button key={m.id} onClick={() => onSelect(m.id)} className="relative shrink-0 rounded-lg px-3 py-1.5 text-[13px]">
          {m.id === selected && <motion.span layoutId="tab-active" transition={spring} className="absolute inset-0 rounded-lg bg-ink-3" />}
          <span className={m.id === selected ? 'relative text-fg' : 'relative text-fg-2'}>{mailboxLabel(m)}</span>
        </button>
      ))}
      <button onClick={onCompose} className="ml-auto shrink-0 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-black">
        New
      </button>
    </div>
  )
}
