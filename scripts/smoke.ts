import { JmapClient } from '../src/jmap/client.ts'

const username = process.env.INK_USER ?? ''
const password = process.env.INK_PASSWORD ?? ''
const origin = process.env.INK_ORIGIN ?? ''
if (!username || !password || !origin) {
  console.error('Set INK_USER, INK_PASSWORD and INK_ORIGIN (e.g. https://mail.example.com)')
  process.exit(1)
}
const client = await JmapClient.connect(username, password, origin)
let failures = 0

async function step(name: string, action: () => Promise<void>): Promise<void> {
  try {
    await action()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

let inboxId = ''
let firstThreadId = ''
let identities: Awaited<ReturnType<JmapClient['getIdentities']>> = []
let uploadResult: { blobId: string; type: string; size: number } | null = null

await step('connect', async () => {
  if (!client.accountId) throw new Error('No primary mail account')
})

await step('getMailboxes', async () => {
  const mailboxes = await client.getMailboxes()
  inboxId = mailboxes.find((mailbox) => mailbox.role === 'inbox')?.id ?? ''
  if (!inboxId) throw new Error('Inbox role is missing')
})

let emails: Awaited<ReturnType<JmapClient['queryEmails']>>['emails'] = []
await step('queryEmails inbox', async () => {
  const result = await client.queryEmails({ mailboxId: inboxId, limit: 10 })
  emails = result.emails
  firstThreadId = emails[0]?.threadId ?? ''
  if (!firstThreadId) throw new Error('Inbox has no messages')
})

await step('getThread', async () => {
  const thread = await client.getThread(firstThreadId)
  if (thread.length === 0) throw new Error(`Thread ${firstThreadId} is empty`)
})

await step('getIdentities', async () => {
  identities = await client.getIdentities()
  if (identities.length === 0) {
    const [response] = await client.request([
      ['Identity/set', {
        accountId: client.accountId,
        create: {
          smokeIdentity: {
            name: 'Aino Korhonen',
            email: username,
          },
        },
      }, 'identitySet'],
    ])
    const created = response?.[1].created as Record<string, { id?: string }> | undefined
    const identityId = created?.smokeIdentity?.id
    if (!identityId) {
      const issue = (response?.[1].notCreated as Record<string, { description?: string }> | undefined)
        ?.smokeIdentity
      throw new Error(`Identity/get was empty and Identity/set failed: ${issue?.description ?? 'unknown error'}`)
    }
    identities = [{ id: identityId, name: 'Aino Korhonen', email: username }]
    console.log('NOTE Identity/get was empty; created a smoke identity.')
  }
})

await step('upload', async () => {
  uploadResult = await client.upload(new Blob(['Ink JMAP smoke attachment'], { type: 'text/plain' }))
  if (!uploadResult.blobId) throw new Error('Upload response has no blobId')
})

await step('send to self', async () => {
  const identity = identities[0]
  if (!identity) throw new Error('No identity is available')
  const started = Date.now()
  let changeReceived = false
  let sendStarted = false
  let changes: Promise<void>
  let resolveChange!: () => void
  let rejectChange!: (error: Error) => void
  changes = new Promise<void>((resolve, reject) => {
    resolveChange = resolve
    rejectChange = reject
  })
  const unsubscribe = client.subscribe(['Email', 'EmailSubmission'], (change) => {
    if (sendStarted && Object.keys(change.changed).length > 0) {
      changeReceived = true
      resolveChange()
    }
  })
  const timeout = setTimeout(() => rejectChange(new Error('No StateChange received within 20 seconds')), 20_000)
  try {
    sendStarted = true
    await client.send({
      identityId: identity.id,
      from: { name: identity.name || null, email: identity.email },
      to: [{ name: null, email: username }],
      subject: `Ink smoke check ${new Date().toISOString()}`,
      text: 'A short self-addressed JMAP submission check.',
    })
    if (!changeReceived) await changes
    if (Date.now() - started > 20_000) throw new Error('StateChange arrived too late')
  } finally {
    clearTimeout(timeout)
    unsubscribe()
  }
})

if (failures > 0) {
  console.log(`Smoke failed: ${failures} step(s).`)
  process.exitCode = 1
} else {
  console.log('Smoke passed: all JMAP operations and push notification verified.')
}
