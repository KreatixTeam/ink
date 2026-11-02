import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AuthError, JmapClient } from '../jmap/client'

const KEY = 'ink:auth'

type Status = 'booting' | 'signed-out' | 'ready'

interface SessionValue {
  status: Status
  client: JmapClient | null
  signIn: (username: string, password: string, remember: boolean) => Promise<void>
  signOut: () => void
}

const Ctx = createContext<SessionValue | null>(null)

function readStored(): { u: string; p: string } | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
    return raw ? JSON.parse(atob(raw)) : null
  } catch {
    return null
  }
}

function store(u: string, p: string, remember: boolean) {
  const raw = btoa(JSON.stringify({ u, p }))
  ;(remember ? localStorage : sessionStorage).setItem(KEY, raw)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('booting')
  const [client, setClient] = useState<JmapClient | null>(null)

  useEffect(() => {
    const saved = readStored()
    if (!saved) {
      setStatus('signed-out')
      return
    }
    JmapClient.connect(saved.u, saved.p)
      .then((c) => {
        setClient(c)
        setStatus('ready')
      })
      .catch((e) => {
        if (e instanceof AuthError) {
          localStorage.removeItem(KEY)
          sessionStorage.removeItem(KEY)
        }
        setStatus('signed-out')
      })
  }, [])

  const signIn = useCallback(async (username: string, password: string, remember: boolean) => {
    const c = await JmapClient.connect(username.trim(), password)
    store(username.trim(), password, remember)
    setClient(c)
    setStatus('ready')
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
    setClient(null)
    setStatus('signed-out')
  }, [])

  return <Ctx.Provider value={{ status, client, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useSession(): SessionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}
