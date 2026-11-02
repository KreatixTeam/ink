import { useCallback, useEffect, useRef, useState } from 'react'
import type { JmapClient } from '../jmap/client'
import type { EmailFull, EmailSummary, Identity, Mailbox } from '../jmap/types'

export const ROLE_ORDER = ['inbox', 'drafts', 'sent', 'archive', 'junk', 'trash']

export function sortMailboxes(list: Mailbox[]): Mailbox[] {
  const rank = (m: Mailbox) => {
    const i = m.role ? ROLE_ORDER.indexOf(m.role) : -1
    return i === -1 ? 100 + m.sortOrder : i
  }
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

export function mailboxLabel(m: Mailbox): string {
  if (!m.role) return m.name
  const map: Record<string, string> = {
    inbox: 'Inbox', drafts: 'Drafts', sent: 'Sent', archive: 'Archive', junk: 'Spam', trash: 'Trash',
  }
  return map[m.role] ?? m.name
}

export function usePush(client: JmapClient | null): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!client) return
    let t: ReturnType<typeof setTimeout> | undefined
    const stop = client.subscribe(['Email', 'Mailbox', 'Thread'], () => {
      clearTimeout(t)
      t = setTimeout(() => setTick((n) => n + 1), 120)
    })
    return () => {
      clearTimeout(t)
      stop()
    }
  }, [client])
  return tick
}

export function useMailboxes(client: JmapClient | null, tick: number) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  useEffect(() => {
    if (!client) return
    let alive = true
    client.getMailboxes().then((m) => alive && setMailboxes(sortMailboxes(m))).catch(() => {})
    return () => {
      alive = false
    }
  }, [client, tick])
  return [mailboxes, setMailboxes] as const
}

export function useIdentities(client: JmapClient | null) {
  const [ids, setIds] = useState<Identity[]>([])
  useEffect(() => {
    if (!client) return
    client.getIdentities().then(setIds).catch(() => {})
  }, [client])
  return ids
}

const PAGE = 60

export function useEmailList(client: JmapClient | null, mailboxId: string | null, text: string, tick: number) {
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const key = `${mailboxId}|${text}`
  const keyRef = useRef(key)
  const lenRef = useRef(0)
  lenRef.current = emails.length

  useEffect(() => {
    if (!client || (!mailboxId && !text)) return
    const changedKey = keyRef.current !== key
    keyRef.current = key
    if (changedKey) setLoading(true)
    let alive = true
    const limit = changedKey ? PAGE : Math.max(PAGE, lenRef.current)
    client
      .queryEmails({ mailboxId: text ? undefined : mailboxId ?? undefined, text: text || undefined, limit })
      .then((r) => {
        if (!alive) return
        setEmails(r.emails)
        setTotal(r.total)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [client, key, mailboxId, text, tick])

  const loadMore = useCallback(async () => {
    if (!client || emails.length >= total) return
    const r = await client.queryEmails({
      mailboxId: text ? undefined : mailboxId ?? undefined,
      text: text || undefined,
      position: emails.length,
      limit: PAGE,
    })
    setEmails((prev) => {
      const seen = new Set(prev.map((e) => e.id))
      return [...prev, ...r.emails.filter((e) => !seen.has(e.id))]
    })
    setTotal(r.total)
  }, [client, emails.length, total, mailboxId, text])

  return { emails, setEmails, total, loading, loadMore }
}

export function useThread(client: JmapClient | null, threadId: string | null, tick: number) {
  const [thread, setThread] = useState<EmailFull[] | null>(null)
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!client || !threadId) {
      setThread(null)
      return
    }
    if (last.current !== threadId) setThread(null)
    last.current = threadId
    let alive = true
    client.getThread(threadId).then((t) => alive && setThread(t)).catch(() => {})
    return () => {
      alive = false
    }
  }, [client, threadId, tick])
  return thread
}
