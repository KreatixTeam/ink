import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthError, JmapClient, SseStateParser } from './client'

const origin = 'http://localhost:4173'
const session = {
  username: 'jmap-user',
  accounts: {},
  primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account-1' },
  capabilities: {},
  apiUrl: 'https://mail.kreatix.dev/jmap/',
  downloadUrl: 'https://mail.kreatix.dev/jmap/download/{accountId}/{blobId}/{name}?accept={type}',
  uploadUrl: 'https://mail.kreatix.dev/jmap/upload/{accountId}/',
  eventSourceUrl: 'https://mail.kreatix.dev/jmap/eventsource/?types={types}&closeafter={closeafter}&ping={ping}',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function connectedClient(apiResponse: unknown): Promise<JmapClient> {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse(session))
    .mockResolvedValueOnce(jsonResponse(apiResponse))
  vi.stubGlobal('fetch', fetchMock)
  return JmapClient.connect('user', 'pass', origin)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('JmapClient', () => {
  it('authenticates and rewrites every session URL to the SPA origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(session))
    vi.stubGlobal('fetch', fetchMock)
    const client = await JmapClient.connect('user', 'päss', origin)
    expect(fetchMock).toHaveBeenCalledWith(`${origin}/jmap/session`, {
      headers: { Authorization: expect.stringMatching(/^Basic /) },
    })
    expect(client.accountId).toBe('account-1')
    expect(client.session.apiUrl).toBe(`${origin}/jmap/`)
    expect(client.session.uploadUrl).toBe(`${origin}/jmap/upload/{accountId}/`)
    expect(client.session.downloadUrl).toContain(`${origin}/jmap/download/`)
    expect(client.session.eventSourceUrl).toContain(`${origin}/jmap/eventsource/`)
  })

  it('maps a 401 session response to AuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    await expect(JmapClient.connect('user', 'wrong', origin)).rejects.toBeInstanceOf(AuthError)
  })

  it('queries and gets email summaries in one call using a result reference', async () => {
    const client = await connectedClient({
      methodResponses: [
        ['Email/query', {
          ids: ['email-1'],
          total: 1,
          queryState: 'query-state',
          position: 0,
        }, 'query'],
        ['Email/get', {
          list: [{
            id: 'email-1',
            threadId: 'thread-1',
            mailboxIds: { inbox: true },
            keywords: { '$seen': true },
            from: [{ name: 'Sender', email: 'sender@example.test' }],
            to: [],
            cc: [],
            subject: 'Hello',
            preview: 'Preview',
            receivedAt: '2025-01-01T00:00:00Z',
            hasAttachment: false,
            size: 12,
          }],
        }, 'emails'],
      ],
    })

    const result = await client.queryEmails({ mailboxId: 'inbox', text: 'hello' })
    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const request = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(request.methodCalls).toHaveLength(2)
    expect(request.methodCalls[0]).toEqual([
      'Email/query',
      expect.objectContaining({
        filter: {
          operator: 'AND',
          conditions: [{ inMailbox: 'inbox' }, { text: 'hello' }],
        },
        sort: [{ property: 'receivedAt', isAscending: false }],
      }),
      'query',
    ])
    expect(request.methodCalls[1][1]['#ids']).toEqual({
      resultOf: 'query',
      name: 'Email/query',
      path: '/ids',
    })
    expect(result.emails[0].id).toBe('email-1')
  })

  it('creates a draft and submission with the sent-mailbox success patch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({
        methodResponses: [['Mailbox/get', {
          list: [
            { id: 'drafts-id', name: 'Drafts', role: 'drafts' },
            { id: 'sent-id', name: 'Sent', role: 'sent' },
          ],
        }, 'mailboxes']],
      }))
      .mockResolvedValueOnce(jsonResponse({
        methodResponses: [
          ['Email/set', { created: { draft: { id: 'email-id' } } }, 'emailSet'],
          ['EmailSubmission/set', { created: { submission: { id: 'submission-id' } } }, 'submissionSet'],
        ],
      }))
    vi.stubGlobal('fetch', fetchMock)
    const client = await JmapClient.connect('user', 'pass', origin)
    await client.getMailboxes()
    await client.send({
      identityId: 'identity-1',
      from: { name: 'User', email: 'user@example.test' },
      to: [{ name: null, email: 'recipient@example.test' }],
      subject: 'Hello',
      text: 'A short message',
    })
    const request = JSON.parse(String(fetchMock.mock.calls[2][1]?.body))
    const [emailSet, submissionSet] = request.methodCalls
    expect(emailSet[0]).toBe('Email/set')
    expect(emailSet[1].create.draft).toMatchObject({
      mailboxIds: { 'drafts-id': true },
      keywords: { '$draft': true, '$seen': true },
    })
    expect(emailSet[1].create.draft.bodyStructure.charset).toBeUndefined()
    expect(submissionSet[0]).toBe('EmailSubmission/set')
    expect(submissionSet[1].create.submission.emailId).toBe('#draft')
    expect(submissionSet[1].onSuccessUpdateEmail['#submission']).toEqual({
      'mailboxIds/drafts-id': null,
      'mailboxIds/sent-id': true,
      'keywords/$draft': null,
    })
  })

  it('uploads to the account-specific upload URL', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({
        blobId: 'blob-1',
        type: 'text/plain',
        size: 4,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const client = await JmapClient.connect('user', 'pass', origin)
    await client.upload(new Blob(['test'], { type: 'text/plain' }))
    expect(fetchMock.mock.calls[1][0]).toBe(`${origin}/jmap/upload/account-1/`)
  })
})

describe('SseStateParser', () => {
  it('parses split CRLF frames and multiline data while ignoring ping and comments', () => {
    const changes: unknown[] = []
    const parser = new SseStateParser((change) => changes.push(change))
    const chunks = [
      ': keepalive\r',
      '\n',
      'event: ping\r\n\r\n',
      'event: state\r\n',
      'data: {"changed":\r\n',
      'data: {"account-1":{"Email":"state-2"}}}\r\n\r\n',
      'event: state\n',
      'data: {"changed":{"account-1":{"Mailbox":"state-3"}}}\n\n',
    ]
    for (const chunk of chunks) parser.push(chunk)
    expect(changes).toEqual([
      { changed: { 'account-1': { Email: 'state-2' } } },
      { changed: { 'account-1': { Mailbox: 'state-3' } } },
    ])
  })
})
