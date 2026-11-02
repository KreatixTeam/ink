import { motion } from 'motion/react'
import type { Mailbox } from '../jmap/types'
import { mailboxLabel } from '../state/mail'
import { spring } from '../lib/motion'
import { cx } from '../lib/format'

export function Sidebar({
  mailboxes, selected, onSelect, onCompose, account, onSignOut,
}: {
  mailboxes: Mailbox[]
  selected: string | null
  onSelect: (id: string) => void
  onCompose: () => void
  account: string
  onSignOut: () => void
}) {
  return (
    <div className="flex h-full w-[232px] shrink-0 flex-col border-r border-line bg-ink-0 px-3 py-3">
      <div className="flex items-center gap-2.5 px-2 pb-4 pt-1">
        <div className="size-2.5 rounded-full bg-white" />
        <span className="text-[15px] font-semibold tracking-tight">ink</span>
      </div>

      <motion.button
        onClick={onCompose}
        whileTap={{ scale: 0.98 }}
        transition={spring}
        className="mb-4 h-9 rounded-xl bg-white text-[13px] font-medium text-black"
      >
        New message
      </motion.button>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
        {mailboxes.map((m) => {
          const active = m.id === selected
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="relative flex h-8 items-center justify-between rounded-lg px-2.5 text-[13px]"
            >
              {active && (
                <motion.span
                  layoutId="mailbox-active"
                  transition={spring}
                  className="absolute inset-0 rounded-lg bg-ink-3"
                />
              )}
              <span className={cx('relative truncate', active ? 'text-fg' : 'text-fg-2')}>{mailboxLabel(m)}</span>
              {m.unreadEmails > 0 && (
                <span className={cx('relative ml-2 shrink-0 text-[11px] tabular-nums', active ? 'text-fg-2' : 'text-fg-3')}>
                  {m.unreadEmails}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <button
        onClick={onSignOut}
        className="mt-3 flex h-8 items-center truncate rounded-lg px-2.5 text-left text-[12px] text-fg-3 hover:text-fg-2"
        title={account}
      >
        {account}
      </button>
    </div>
  )
}
