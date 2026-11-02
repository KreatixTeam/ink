import type { EmailAddress } from './types'

export function formatAddress(address: EmailAddress): string {
  if (!address.name) return address.email
  const name = /[",;]/.test(address.name)
    ? `"${address.name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
    : address.name
  return `${name} <${address.email}>`
}

export function displayName(address: EmailAddress): string {
  return address.name?.trim() || address.email.split('@')[0] || address.email
}

export function parseAddressList(input: string): EmailAddress[] {
  const entries: string[] = []
  let start = 0
  let inQuotes = false
  let escaped = false
  let angleDepth = 0

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (escaped) {
      escaped = false
      continue
    }
    if (inQuotes && character === '\\') {
      escaped = true
      continue
    }
    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && character === '<') {
      angleDepth += 1
      continue
    }
    if (!inQuotes && character === '>') {
      angleDepth = Math.max(0, angleDepth - 1)
      continue
    }
    if (!inQuotes && angleDepth === 0 && (character === ',' || character === ';')) {
      entries.push(input.slice(start, index))
      start = index + 1
    }
  }
  entries.push(input.slice(start))

  return entries.flatMap((entry) => {
    const value = entry.trim()
    if (!value) return []

    const angleMatch = /^(.*?)\s*<\s*([^<>]+?)\s*>$/.exec(value)
    if (angleMatch) {
      const rawName = angleMatch[1].trim()
      const name = rawName.startsWith('"') && rawName.endsWith('"')
        ? rawName.slice(1, -1).replace(/\\(["\\])/g, '$1')
        : rawName
      const email = angleMatch[2].trim()
      return email ? [{ name: name || null, email }] : []
    }

    const emailMatch = /<\s*([^<>]+?)\s*>/.exec(value)
    const email = (emailMatch?.[1] ?? value).trim()
    if (!email || /\s/.test(email)) return []
    return [{ name: null, email }]
  })
}
