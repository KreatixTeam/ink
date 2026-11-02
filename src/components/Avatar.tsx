import type { EmailAddress } from '../jmap/types'
import { hue, initials } from '../lib/format'

export function Avatar({ who, size = 32 }: { who: EmailAddress | undefined; size?: number }) {
  const seed = who?.email ?? '?'
  const h = hue(seed)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `oklch(0.28 0.05 ${h})`,
        color: `oklch(0.88 0.06 ${h})`,
      }}
    >
      {initials(who?.name || who?.email || '?')}
    </div>
  )
}
