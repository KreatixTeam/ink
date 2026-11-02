import type {
  Attachment,
  EmailAddress,
  EmailFull,
  EmailSummary,
  Identity,
  Mailbox,
  StateChange,
} from './types'

const CORE = 'urn:ietf:params:jmap:core'
const MAIL = 'urn:ietf:params:jmap:mail'
const SUBMISSION = 'urn:ietf:params:jmap:submission'
const EMAIL_SUMMARY_PROPERTIES = [
  'id',
  'threadId',
  'mailboxIds',
  'keywords',
  'from',
  'to',
  'cc',
  'subject',
  'preview',
  'receivedAt',
  'hasAttachment',
  'size',
]
const EMAIL_FULL_PROPERTIES = [
  ...EMAIL_SUMMARY_PROPERTIES,
  'bcc',
  'replyTo',
  'sentAt',
  'messageId',
  'inReplyTo',
  'references',
  'htmlBody',
  'textBody',
  'bodyValues',
  'attachments',
]

type MethodCall = [string, Record<string, unknown>, string]
type MethodResponse = [string, Record<string, unknown>, string]

interface JmapSession {
  username?: string
  accounts: Record<string, unknown>
  primaryAccounts: Record<string, string>
  capabilities: Record<string, unknown>
  apiUrl: string
  downloadUrl: string
  uploadUrl: string
  eventSourceUrl: string
  state?: string
}

export class AuthError extends Error {
  constructor(message = 'JMAP authentication failed') {
    super(message)
    this.name = 'AuthError'
  }
}

export class JmapMethodError extends Error {
  type: string
  description: string

  constructor(type: string, description: string) {
    super(description || type)
    this.name = 'JmapMethodError'
    this.type = type
    this.description = description
  }
}

function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

function rewriteOrigin(url: string, origin: string): string {
  const result = new URL(url, origin)
  const replacementOrigin = new URL(origin)
  result.protocol = replacementOrigin.protocol
  result.host = replacementOrigin.host
  return result.toString().replace(/%7B/gi, '{').replace(/%7D/gi, '}')
}

function asAddresses(value: unknown): EmailAddress[] {
  return Array.isArray(value)
    ? value.map((address) => ({
      name: typeof address?.name === 'string' ? address.name : null,
      email: typeof address?.email === 'string' ? address.email : '',
    }))
    : []
}

function truthyMap(value: unknown): Record<string, true> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, enabled]) => enabled === true),
  ) as Record<string, true>
}

function asEmailSummary(email: Record<string, unknown>): EmailSummary {
  return {
    id: String(email.id ?? ''),
    threadId: String(email.threadId ?? ''),
    mailboxIds: truthyMap(email.mailboxIds),
    keywords: truthyMap(email.keywords),
    from: asAddresses(email.from),
    to: asAddresses(email.to),
    cc: asAddresses(email.cc),
    subject: String(email.subject ?? ''),
    preview: String(email.preview ?? ''),
    receivedAt: String(email.receivedAt ?? ''),
    hasAttachment: email.hasAttachment === true,
    size: Number(email.size ?? 0),
  }
}

function isHtmlBody(parts: unknown): boolean {
  return Array.isArray(parts) && parts.some((part) => part?.type === 'text/html')
}

function decodeBody(
  bodyParts: unknown,
  bodyValues: unknown,
): string | null {
  if (!Array.isArray(bodyParts) || bodyParts.length === 0) return null
  const values = (bodyValues && typeof bodyValues === 'object'
    ? bodyValues
    : {}) as Record<string, { value?: unknown }>
  const result = bodyParts
    .map((part) => {
      const partId = typeof part?.partId === 'string' ? part.partId : ''
      return typeof values[partId]?.value === 'string' ? values[partId].value : ''
    })
    .join('')
  return result || null
}

function listOrNull(value: unknown): string[] | null {
  return Array.isArray(value) ? value.map(String) : null
}

function encodePathComponent(value: string): string {
  return encodeURIComponent(value)
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timeout = setTimeout(done, milliseconds)
    function done() {
      clearTimeout(timeout)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export class SseStateParser {
  private buffer = ''
  private readonly onChange: (change: StateChange) => void

  constructor(onChange: (change: StateChange) => void) {
    this.onChange = onChange
  }

  push(chunk: string): void {
    this.buffer += chunk
    let boundary: RegExpExecArray | null
    const frameBoundary = /\r?\n\r?\n/g
    while ((boundary = frameBoundary.exec(this.buffer)) !== null) {
      const frame = this.buffer.slice(0, boundary.index)
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length)
      frameBoundary.lastIndex = 0
      this.consume(frame)
    }
  }

  finish(): void {
    if (this.buffer) this.consume(this.buffer)
    this.buffer = ''
  }

  private consume(frame: string): void {
    let event = 'message'
    const data: string[] = []
    for (const line of frame.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) continue
      const separator = line.indexOf(':')
      const field = separator < 0 ? line : line.slice(0, separator)
      const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
      if (field === 'event') event = value
      if (field === 'data') data.push(value)
    }
    if (event !== 'state' || data.length === 0) return
    try {
      const parsed: unknown = JSON.parse(data.join('\n'))
      if (parsed && typeof parsed === 'object' && 'changed' in parsed) {
        this.onChange(parsed as StateChange)
      }
    } catch {}
  }
}

export class JmapClient {
  readonly session: JmapSession
  readonly accountId: string
  readonly username: string
  private readonly authorization: string
  private mailboxCache: Mailbox[] | null = null

  private constructor(
    session: JmapSession,
    username: string,
    authorization: string,
  ) {
    this.session = session
    this.accountId = session.primaryAccounts[MAIL]
    this.username = username
    this.authorization = authorization
  }

  static async connect(
    username: string,
    password: string,
    origin = globalThis.location?.origin,
  ): Promise<JmapClient> {
    if (!origin) throw new Error('An origin is required outside a browser')
    const authorization = basicAuthorization(username, password)
    const response = await fetch(`${origin.replace(/\/$/, '')}/jmap/session`, {
      headers: { Authorization: authorization },
    })
    if (response.status === 401) throw new AuthError()
    if (!response.ok) throw new Error(`JMAP session request failed (${response.status})`)
    const session = await response.json() as JmapSession
    if (!session.primaryAccounts?.[MAIL]) {
      throw new Error('The JMAP session has no primary mail account')
    }
    session.apiUrl = rewriteOrigin(session.apiUrl, origin)
    session.downloadUrl = rewriteOrigin(session.downloadUrl, origin)
    session.uploadUrl = rewriteOrigin(session.uploadUrl, origin)
    session.eventSourceUrl = rewriteOrigin(session.eventSourceUrl, origin)
    return new JmapClient(session, username, authorization)
  }

  async request(calls: MethodCall[]): Promise<MethodResponse[]> {
    const response = await fetch(this.session.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: this.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        using: [CORE, MAIL, SUBMISSION],
        methodCalls: calls,
      }),
    })
    if (response.status === 401) throw new AuthError()
    if (!response.ok) throw new Error(`JMAP API request failed (${response.status})`)
    const payload = await response.json() as { methodResponses?: MethodResponse[] }
    const methodResponses = payload.methodResponses ?? []
    const failure = methodResponses.find(([name]) => name === 'error')
    if (failure) {
      const args = failure[1]
      throw new JmapMethodError(String(args.type ?? 'error'), String(args.description ?? ''))
    }
    return methodResponses
  }

  async getMailboxes(): Promise<Mailbox[]> {
    const [response] = await this.request([
      ['Mailbox/get', {
        accountId: this.accountId,
        properties: [
          'id',
          'name',
          'role',
          'parentId',
          'sortOrder',
          'totalEmails',
          'unreadEmails',
          'totalThreads',
          'unreadThreads',
        ],
      }, 'mailboxes'],
    ])
    const list = response?.[1].list
    const mailboxes = Array.isArray(list) ? list : []
    this.mailboxCache = mailboxes.map((mailbox) => ({
      id: String(mailbox.id ?? ''),
      name: String(mailbox.name ?? ''),
      role: typeof mailbox.role === 'string' ? mailbox.role : null,
      parentId: typeof mailbox.parentId === 'string' ? mailbox.parentId : null,
      sortOrder: Number(mailbox.sortOrder ?? 0),
      totalEmails: Number(mailbox.totalEmails ?? 0),
      unreadEmails: Number(mailbox.unreadEmails ?? 0),
      totalThreads: Number(mailbox.totalThreads ?? 0),
      unreadThreads: Number(mailbox.unreadThreads ?? 0),
    }))
    return this.mailboxCache
  }

  async queryEmails({
    mailboxId,
    text,
    position = 0,
    limit = 50,
    collapseThreads = true,
  }: {
    mailboxId?: string
    text?: string
    position?: number
    limit?: number
    collapseThreads?: boolean
  } = {}): Promise<{
    ids: string[]
    total: number
    queryState: string
    position: number
    emails: EmailSummary[]
  }> {
    const filters: Record<string, unknown>[] = []
    if (mailboxId) filters.push({ inMailbox: mailboxId })
    if (text?.trim()) filters.push({ text: text.trim() })
    const filter = filters.length > 1 ? { operator: 'AND', conditions: filters } : filters[0]
    const calls: MethodCall[] = [
      ['Email/query', {
        accountId: this.accountId,
        ...(filter ? { filter } : {}),
        sort: [{ property: 'receivedAt', isAscending: false }],
        position,
        limit,
        collapseThreads,
      }, 'query'],
      ['Email/get', {
        accountId: this.accountId,
        '#ids': { resultOf: 'query', name: 'Email/query', path: '/ids' },
        properties: EMAIL_SUMMARY_PROPERTIES,
      }, 'emails'],
    ]
    const responses = await this.request(calls)
    const query = responses.find(([, , id]) => id === 'query')?.[1] ?? {}
    const get = responses.find(([, , id]) => id === 'emails')?.[1] ?? {}
    const ids = Array.isArray(query.ids) ? query.ids.map(String) : []
    const emails = Array.isArray(get.list) ? get.list : []
    const byId = new Map(emails.map((email) => [String(email.id), asEmailSummary(email)]))
    return {
      ids,
      total: Number(query.total ?? ids.length),
      queryState: String(query.queryState ?? ''),
      position: Number(query.position ?? position),
      emails: ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []),
    }
  }

  async getThread(threadId: string): Promise<EmailFull[]> {
    const responses = await this.request([
      ['Thread/get', {
        accountId: this.accountId,
        ids: [threadId],
      }, 'thread'],
      ['Email/get', {
        accountId: this.accountId,
        '#ids': { resultOf: 'thread', name: 'Thread/get', path: '/list/0/emailIds' },
        properties: EMAIL_FULL_PROPERTIES,
        fetchHTMLBodyValues: true,
        fetchTextBodyValues: true,
        maxBodyValueBytes: 2_000_000,
      }, 'emails'],
    ])
    const emails = responses.find(([, , id]) => id === 'emails')?.[1].list
    if (!Array.isArray(emails)) return []
    return emails
      .map((email): EmailFull => {
        const summary = asEmailSummary(email)
        const attachments: Attachment[] = Array.isArray(email.attachments)
          ? email.attachments.map((attachment: Record<string, unknown>) => ({
            blobId: String(attachment.blobId ?? ''),
            name: typeof attachment.name === 'string' ? attachment.name : null,
            type: String(attachment.type ?? 'application/octet-stream'),
            size: Number(attachment.size ?? 0),
            cid: typeof attachment.cid === 'string' ? attachment.cid : null,
            disposition: typeof attachment.disposition === 'string' ? attachment.disposition : null,
          }))
          : []
        return {
          ...summary,
          bcc: asAddresses(email.bcc),
          replyTo: asAddresses(email.replyTo),
          sentAt: typeof email.sentAt === 'string' ? email.sentAt : null,
          messageId: listOrNull(email.messageId),
          inReplyTo: listOrNull(email.inReplyTo),
          references: listOrNull(email.references),
          html: isHtmlBody(email.htmlBody) ? decodeBody(email.htmlBody, email.bodyValues) : null,
          text: decodeBody(email.textBody, email.bodyValues),
          attachments,
        }
      })
      .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))
  }

  async setKeyword(ids: string[], keyword: string, value: boolean): Promise<void> {
    const patch: Record<string, boolean | null> = { [`keywords/${keyword}`]: value ? true : null }
    await this.request([
      ['Email/set', {
        accountId: this.accountId,
        update: Object.fromEntries(ids.map((id) => [id, patch])),
      }, 'setKeyword'],
    ])
  }

  async moveEmails(ids: string[], fromMailboxId: string, toMailboxId: string): Promise<void> {
    await this.request([
      ['Email/set', {
        accountId: this.accountId,
        update: Object.fromEntries(ids.map((id) => [id, {
          [`mailboxIds/${fromMailboxId}`]: null,
          [`mailboxIds/${toMailboxId}`]: true,
        }])),
      }, 'moveEmails'],
    ])
  }

  async destroyEmails(ids: string[]): Promise<void> {
    await this.request([
      ['Email/set', { accountId: this.accountId, destroy: ids }, 'destroyEmails'],
    ])
  }

  async getIdentities(): Promise<Identity[]> {
    const [response] = await this.request([
      ['Identity/get', { accountId: this.accountId }, 'identities'],
    ])
    const list = response?.[1].list
    return Array.isArray(list)
      ? list.map((identity) => ({
        id: String(identity.id ?? ''),
        name: String(identity.name ?? ''),
        email: String(identity.email ?? ''),
      }))
      : []
  }

  async upload(blob: Blob): Promise<{ blobId: string; type: string; size: number }> {
    const uploadUrl = this.session.uploadUrl.replaceAll(
      '{accountId}',
      encodePathComponent(this.accountId),
    )
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: this.authorization,
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    })
    if (response.status === 401) throw new AuthError()
    if (!response.ok) throw new Error(`JMAP upload failed (${response.status})`)
    const result = await response.json() as { blobId: string; type?: string; size?: number }
    return {
      blobId: result.blobId,
      type: result.type ?? blob.type ?? 'application/octet-stream',
      size: Number(result.size ?? blob.size),
    }
  }

  async fetchBlob(blobId: string, name: string, type: string): Promise<Blob> {
    const url = this.session.downloadUrl
      .replaceAll('{accountId}', encodePathComponent(this.accountId))
      .replaceAll('{blobId}', encodePathComponent(blobId))
      .replaceAll('{name}', encodePathComponent(name))
      .replaceAll('{type}', encodeURIComponent(type))
    const response = await fetch(url, {
      headers: {
        Authorization: this.authorization,
        Accept: type,
      },
    })
    if (response.status === 401) throw new AuthError()
    if (!response.ok) throw new Error(`JMAP download failed (${response.status})`)
    return response.blob()
  }

  async send({
    identityId,
    from,
    to,
    cc = [],
    bcc = [],
    subject,
    text,
    html,
    attachments = [],
    inReplyTo,
    references,
  }: {
    identityId: string
    from: EmailAddress
    to: EmailAddress[]
    cc?: EmailAddress[]
    bcc?: EmailAddress[]
    subject: string
    text: string
    html?: string
    attachments?: { blobId: string; type: string; name: string; size: number }[]
    inReplyTo?: string[]
    references?: string[]
  }): Promise<void> {
    const mailboxes = this.mailboxCache ?? await this.getMailboxes()
    const draftsId = mailboxes.find((mailbox) => mailbox.role === 'drafts')?.id
    const sentId = mailboxes.find((mailbox) => mailbox.role === 'sent')?.id
    if (!draftsId || !sentId) {
      throw new Error('Cannot send mail: Drafts or Sent mailbox is missing')
    }

    const textPart = { partId: 'text', type: 'text/plain', disposition: 'inline' }
    const bodyValues: Record<string, { value: string }> = { text: { value: text } }
    let bodyStructure: Record<string, unknown>
    if (html) {
      bodyValues.html = { value: html }
      const htmlPart = { partId: 'html', type: 'text/html', disposition: 'inline' }
      const bodyParts = [textPart, htmlPart]
      if (attachments.length > 0) {
        bodyStructure = {
          type: 'multipart/mixed',
          subParts: [{
            type: 'multipart/alternative',
            subParts: bodyParts,
          }, ...attachments.map((attachment) => ({
            blobId: attachment.blobId,
            type: attachment.type,
            name: attachment.name,
            size: attachment.size,
            disposition: 'attachment',
          }))],
        }
      } else {
        bodyStructure = { type: 'multipart/alternative', subParts: bodyParts }
      }
    } else if (attachments.length > 0) {
      bodyStructure = {
        type: 'multipart/mixed',
        subParts: [
          textPart,
          ...attachments.map((attachment) => ({
            blobId: attachment.blobId,
            type: attachment.type,
            name: attachment.name,
            size: attachment.size,
            disposition: 'attachment',
          })),
        ],
      }
    } else {
      bodyStructure = textPart
    }

    const draft: Record<string, unknown> = {
      mailboxIds: { [draftsId]: true },
      keywords: { '$draft': true, '$seen': true },
      from: [from],
      to,
      cc,
      bcc,
      subject,
      bodyStructure,
      bodyValues,
      ...(inReplyTo ? { inReplyTo } : {}),
      ...(references ? { references } : {}),
    }
    const sentPatch = {
      [`mailboxIds/${draftsId}`]: null,
      [`mailboxIds/${sentId}`]: true,
      'keywords/$draft': null,
    }
    const responses = await this.request([
      ['Email/set', {
        accountId: this.accountId,
        create: { draft },
      }, 'emailSet'],
      ['EmailSubmission/set', {
        accountId: this.accountId,
        create: {
          submission: {
            identityId,
            emailId: '#draft',
            envelope: {
              mailFrom: { email: from.email },
              rcptTo: [...to, ...cc, ...bcc].map(({ email }) => ({ email })),
            },
          },
        },
        onSuccessUpdateEmail: {
          '#submission': sentPatch,
        },
      }, 'submissionSet'],
    ])
    const submission = responses.find(([, , id]) => id === 'submissionSet')?.[1] ?? {}
    const notCreated = submission.notCreated as Record<string, unknown> | undefined
    if (notCreated?.submission) {
      const failure = notCreated.submission as { type?: string; description?: string }
      throw new Error(
        `Email submission failed: ${failure.description ?? failure.type ?? 'unknown error'}`,
      )
    }
  }

  subscribe(types: string[], onChange: (change: StateChange) => void): () => void {
    const controller = new AbortController()
    const url = new URL(this.session.eventSourceUrl)
    url.searchParams.set('types', types.join(','))
    url.searchParams.set('closeafter', 'no')
    url.searchParams.set('ping', '30')
    void (async () => {
      let attempt = 0
      while (!controller.signal.aborted) {
        let connectedAt: number | null = null
        try {
          const response = await fetch(url, {
            headers: {
              Authorization: this.authorization,
              Accept: 'text/event-stream',
            },
            signal: controller.signal,
          })
          if (response.status === 401) throw new AuthError()
          if (!response.ok || !response.body) {
            throw new Error(`JMAP event stream failed (${response.status})`)
          }
          connectedAt = Date.now()
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          const parser = new SseStateParser(onChange)
          try {
            while (!controller.signal.aborted) {
              const { value, done } = await reader.read()
              if (done) break
              parser.push(decoder.decode(value, { stream: true }))
            }
            parser.push(decoder.decode())
            parser.finish()
          } finally {
            reader.releaseLock()
          }
        } catch {
          if (controller.signal.aborted) return
        }
        if (controller.signal.aborted) return
        if (connectedAt !== null && Date.now() - connectedAt > 30_000) attempt = 0
        const delay = Math.min(500 * (2 ** attempt), 30_000)
        attempt += 1
        await abortableDelay(delay, controller.signal)
      }
    })()
    return () => controller.abort()
  }
}
