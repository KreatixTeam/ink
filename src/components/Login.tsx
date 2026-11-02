import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSession } from '../state/session'
import { AuthError } from '../jmap/client'
import { spring, fade } from '../lib/motion'
import { cx } from '../lib/format'

export function Login() {
  const { signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password, remember)
    } catch (err) {
      setError(err instanceof AuthError ? 'Wrong email or password' : 'Could not reach the mail server')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        className="w-full max-w-[340px]"
      >
        <div className="mb-10 flex items-center gap-2.5">
          <div className="size-2.5 rounded-full bg-white" />
          <span className="text-[17px] font-semibold tracking-tight">ink</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-ink-1">
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="username" autoFocus />
          <div className="h-px bg-line" />
          <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
        </div>

        <button
          type="button"
          onClick={() => setRemember((r) => !r)}
          className="mt-4 flex items-center gap-2.5 text-[13px] text-fg-2"
        >
          <span className={cx('relative h-[18px] w-[30px] rounded-full transition-colors duration-200', remember ? 'bg-white' : 'bg-ink-4')}>
            <motion.span
              layout
              transition={spring}
              className={cx('absolute top-[2px] size-[14px] rounded-full', remember ? 'right-[2px] bg-black' : 'left-[2px] bg-fg-3')}
            />
          </span>
          Stay signed in
        </button>

        <motion.button
          type="submit"
          disabled={busy}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          className={cx(
            'mt-8 flex h-11 w-full items-center justify-center rounded-xl bg-white text-[14px] font-medium text-black transition-opacity',
            (!email || !password) && 'opacity-40',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.span key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade} className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-black"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.span>
            ) : (
              <motion.span key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                Sign in
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
              className="overflow-hidden text-center text-[13px] text-danger"
            >
              <span className="block pt-4">{error}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </motion.form>
    </div>
  )
}

function Field(props: {
  label: string
  value: string
  onChange: (v: string) => void
  type: string
  autoComplete: string
  autoFocus?: boolean
}) {
  return (
    <label className="flex h-12 items-center gap-3 px-4">
      <span className="w-[72px] shrink-0 text-[13px] text-fg-3">{props.label}</span>
      <input
        className="min-w-0 flex-1"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        type={props.type}
        autoComplete={props.autoComplete}
        autoFocus={props.autoFocus}
        spellCheck={false}
        autoCapitalize="off"
      />
    </label>
  )
}
