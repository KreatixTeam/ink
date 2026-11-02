import { JmapClient } from '../src/jmap/client.ts'

const username = process.env.INK_USER ?? ''
const password = process.env.INK_PASSWORD ?? ''
const origin = process.env.INK_ORIGIN ?? ''
if (!username || !password || !origin) {
  console.error('Set INK_USER, INK_PASSWORD and INK_ORIGIN (e.g. https://mail.example.com)')
  process.exit(1)
}
const force = process.argv.includes('--force')
const client = await JmapClient.connect(username, password, origin)

interface SeedMessage {
  id: string
  daysAgo: number
  from: string
  name: string
  subject: string
  text: string
  html?: string
  folder?: 'archive' | 'sent'
  seen?: boolean
  flagged?: boolean
  replyTo?: string
  references?: string[]
  attachments?: { name: string; type: string; bytes: Uint8Array }[]
}

const pixelPng = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
  'base64',
))
const pdfBytes = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 180]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 16 Tf 32 120 Td (Q3 Planning Notes) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
)

const messages: SeedMessage[] = [
  {
    id: 'studio-intro',
    daysAgo: 20,
    from: 'mira@northstar.studio',
    name: 'Mira Kallio',
    subject: 'Northstar launch notes for Thursday',
    text: 'Hi team,\n\nI pulled the launch checklist into one place. The landing page is ready for a final pass, and the photo selects are in the shared folder. Could you check the Finnish copy before Wednesday afternoon?\n\nMira',
    html: '<div style="font-family:Arial,sans-serif;color:#263238"><h2 style="color:#125b5c">Thursday launch checklist</h2><p>The landing page is ready for a final pass. Please review the Finnish copy by Wednesday afternoon.</p><p><a href="https://northstar.studio/launch">Open the project board</a></p></div>',
    seen: true,
    references: [],
  },
  {
    id: 'studio-reply-1',
    daysAgo: 19,
    from: username,
    name: 'Aino',
    subject: 'Re: Northstar launch notes for Thursday',
    text: 'The Finnish copy reads naturally now. I changed the opening line and left a note about the accessibility labels on the signup form.\n\nAino',
    folder: 'sent',
    seen: true,
    replyTo: '<studio-intro@northstar.studio>',
    references: ['<studio-intro@northstar.studio>'],
  },
  {
    id: 'studio-reply-2',
    daysAgo: 18,
    from: 'mira@northstar.studio',
    name: 'Mira Kallio',
    subject: 'Re: Northstar launch notes for Thursday',
    text: 'Perfect, thank you. I have fixed the labels and scheduled the preview for 10:30 on Thursday. The printed cards should arrive tomorrow.',
    seen: true,
    replyTo: '<studio-reply-1@ink.test>',
    references: ['<studio-intro@northstar.studio>', '<studio-reply-1@ink.test>'],
  },
  {
    id: 'aurora-news-1',
    daysAgo: 18,
    from: 'letters@auroraweekly.example',
    name: 'Aurora Weekly',
    subject: 'The small rituals issue: a brighter Monday',
    text: 'This week: a five-minute desk reset, a Helsinki bakery worth the tram ride, and three new essays from independent writers. Save the reading list for your next quiet morning.',
    html: '<table role="presentation" style="width:100%;font-family:Georgia,serif;background:#f7f2e8;color:#25303b"><tr><td style="padding:28px"><p style="letter-spacing:3px;color:#b36b39">AURORA WEEKLY · 18 OCT</p><h1 style="font-size:32px">A brighter Monday</h1><p>Small rituals for a week with room to breathe.</p><img alt="Morning light over a city street" src="https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=720" style="width:100%;border-radius:12px"><p>Our editors picked a five-minute desk reset, a Helsinki bakery worth the tram ride, and three new essays.</p></td></tr></table>',
    seen: true,
  },
  {
    id: 'train-ticket',
    daysAgo: 17,
    from: 'tickets@vr.example',
    name: 'VR Matkalla',
    subject: 'Your Helsinki–Turku ticket · 24 October',
    text: 'Matkustaja: Aino Korhonen\nJuna IC 957\nHelsinki 09:37 → Turku 11:37\nVaunu 4, paikka 18\n\nShow your ticket in the VR app before boarding. Have a good journey!',
    seen: true,
  },
  {
    id: 'team-design',
    daysAgo: 16,
    from: 'leo@northstar.studio',
    name: 'Leo Niemi',
    subject: 'Re: Northstar launch notes for Thursday',
    text: 'The new cards are ready, and I have added the print PDF with the corrected bleed. One small question: should the QR code point to the Finnish page by default?',
    replyTo: '<studio-intro@northstar.studio>',
    references: ['<studio-intro@northstar.studio>', '<studio-reply-1@ink.test>'],
    attachments: [{ name: 'northstar-cards.pdf', type: 'application/pdf', bytes: pdfBytes }],
  },
  {
    id: 'market-mail',
    daysAgo: 15,
    from: 'hello@kauppahalli.example',
    name: 'Kauppahalli',
    subject: 'Saturday at the market: apples, rye & coffee',
    text: 'This Saturday, local growers are bringing late-season apples and root vegetables to the old market hall. The coffee roaster on the south side will be open from 8:00, with fresh korvapuusti until noon.',
    html: '<div style="max-width:620px;margin:auto;font:16px/1.6 Arial,sans-serif;color:#342d28"><div style="background:#315c48;color:white;padding:22px"><span>KAUPPAHALLI · HELSINKI</span><h1>Market morning</h1></div><div style="padding:20px"><p>Apples, rye bread and coffee are waiting this Saturday.</p><img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=720" alt="Fresh produce at a market" style="width:100%;border-radius:8px"><p>Doors open at 8:00. Bring a tote bag and say hello to the growers.</p></div></div>',
    seen: true,
  },
  {
    id: 'family-photo',
    daysAgo: 14,
    from: 'sade.korhonen@example.test',
    name: 'Säde Korhonen',
    subject: 'Mummo’s birthday photos 🎂',
    text: 'Kiitos vielä ihanasta viikonlopusta! Tässä yksi kuva kakusta ja se kuva, jossa kaikki yrittävät mahtua samaan selfieen. Lähetän loput kuvista myöhemmin.\n\nSäde',
    seen: true,
    attachments: [{ name: 'birthday-cake.png', type: 'image/png', bytes: pixelPng }],
  },
  {
    id: 'library-digest',
    daysAgo: 13,
    from: 'updates@helsinkilibrary.example',
    name: 'Helsinki Library',
    subject: 'Your library holds are ready',
    text: 'Two items from your list are ready to collect at Oodi:\n\n• The Creative Act — Rick Rubin\n• The City & the City — China Miéville\n\nPlease collect them by 26 October. The self-service lockers are open around the clock.',
    seen: true,
  },
  {
    id: 'trip-planning',
    daysAgo: 12,
    from: 'elina@seaside.example',
    name: 'Elina Laine',
    subject: 'Re: October weekend in Turku',
    text: 'I booked the little guesthouse by the river for Saturday night. If the weather holds, we can walk the Aura trail before dinner; otherwise the art museum is open until six.',
    replyTo: '<turku-plan@ink.test>',
    references: ['<turku-plan@ink.test>'],
    seen: true,
  },
  {
    id: 'newsletter-fieldnotes',
    daysAgo: 11,
    from: 'dispatch@fieldnotes.example',
    name: 'Field Notes',
    subject: 'Issue 42: making space for good work',
    text: 'In this issue, ceramicist Hana Vu talks about learning to leave a little room around a finished piece. Also: a studio visit in Porvoo and a short guide to keeping a useful notebook.',
    html: '<div style="font:16px/1.7 Georgia,serif;color:#23312c"><header style="background:#e5efdf;padding:26px"><small>FIELD NOTES · ISSUE 42</small><h1 style="font-size:34px">Make a little room</h1><p>Notes on craft, attention and a well-used notebook.</p></header><main style="padding:24px"><img src="https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=720" alt="A quiet creative studio" style="width:100%"><p>Hana Vu makes ceramics in a small studio outside Porvoo. Her latest collection leaves a little more room around each piece.</p><a href="https://fieldnotes.example/issue-42">Read the studio visit →</a></main></div>',
  },
  {
    id: 'invoice-coffee',
    daysAgo: 10,
    from: 'receipts@roastery.example',
    name: 'Harbor Roastery',
    subject: 'Receipt for order HR-2841',
    text: 'Thanks for supporting Harbor Roastery.\n\nEthiopia Guji, 250 g — €14.50\nShipping — €3.90\nTotal — €18.40\n\nYour beans are packed and will leave our roastery tomorrow morning.',
    seen: true,
  },
  {
    id: 'calendar-reminder',
    daysAgo: 9,
    from: 'calendar@northstar.studio',
    name: 'Northstar Studio calendar',
    subject: 'Reminder: project review at 14:00',
    text: 'Project review\nTuesday, 29 October · 14:00–14:45\nNorthstar Studio, meeting room 2\n\nAgenda: landing page, launch copy, and the printed materials.',
  },
  {
    id: 'newsletter-green',
    daysAgo: 8,
    from: 'hello@greensteps.example',
    name: 'Green Steps',
    subject: 'A gentler way to get around town',
    text: 'Our new city guide maps low-traffic streets, repair shops and the best places to lock up a bike. This month’s route follows the shoreline from Ruoholahti to the winter garden.',
    html: '<div style="background:#edf4ef;padding:24px;font-family:Arial,sans-serif;color:#234333"><span style="font-size:12px;letter-spacing:2px">GREEN STEPS · CITY NOTES</span><h1 style="font-size:30px">Take the long way home</h1><p>Follow the shoreline from Ruoholahti to the winter garden on our 7 km route.</p><img src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=720" alt="A green path beside the water" style="display:block;width:100%;border-radius:16px"><p>Along the way: a public sauna, two repair shops and a very good cinnamon bun.</p></div>',
    seen: true,
  },
  {
    id: 'mentor-message',
    daysAgo: 7,
    from: 'jussi@makers.example',
    name: 'Jussi Virtanen',
    subject: 'A thought on the portfolio page',
    text: 'I looked through the new portfolio over lunch. The shorter project summaries are much easier to scan. One thought: bring the results closer to the top, especially on mobile. Happy to talk it through after the meetup.',
    flagged: true,
  },
  {
    id: 'long-project',
    daysAgo: 6,
    from: 'mira@northstar.studio',
    name: 'Mira Kallio',
    subject: 'Notes from the launch retro',
    text: 'Hi everyone,\n\nA few notes while they are fresh. The early content review made the biggest difference: it gave design and engineering a shared starting point instead of a pile of late edits. The preview link was useful, but we should agree on who owns the final copy before the next project.\n\nFor the next round, I would like to keep a short checklist for translated pages, especially links, screen-reader labels, and date formats. We also had a good response to the smaller image set; the page felt calmer and loaded faster on a phone.\n\nThe printed cards arrived on time. The new QR destination is correct, and the shop has already asked for another batch. I have put the final files in the archive folder along with the invoice.\n\nCould everyone add one thing they would keep and one thing they would change to the project board by Friday? I will turn that into a one-page guide for the November launch.\n\nThanks for a thoughtful week,\nMira',
    seen: true,
  },
  {
    id: 'concert',
    daysAgo: 5,
    from: 'boxoffice@musictheatre.example',
    name: 'Music Theatre Helsinki',
    subject: 'Tickets confirmed: Alma Pöysti Quartet',
    text: 'Your tickets are confirmed for Friday 8 November, 19:00.\n\nMusic Theatre Helsinki · Balcony B · Seats 12–13\nOrder MT-77304\n\nDoors open at 18:15. Your mobile tickets are attached to this email.',
    seen: true,
  },
  {
    id: 'aurora-news-2',
    daysAgo: 4,
    from: 'letters@auroraweekly.example',
    name: 'Aurora Weekly',
    subject: 'A city guide for a rainy afternoon',
    text: 'A short list for the days when the forecast has other plans: a small gallery near the harbour, a secondhand bookshop with a reading nook, and a soup counter that stays open late.',
    html: '<table style="max-width:640px;font:16px/1.6 Arial,sans-serif;background:#fffaf3;color:#27313a"><tr><td style="padding:26px"><small style="color:#bd694e">AURORA WEEKLY · CITY GUIDE</small><h1>Rain, well spent</h1><img src="https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=720" alt="Rain on a city window" style="width:100%;border-radius:10px"><p>A gallery, a bookshop with a reading nook, and soup that stays warm until late.</p><a href="https://auroraweekly.example/helsinki-rain">Save the map</a></td></tr></table>',
  },
  {
    id: 'turku-plan',
    daysAgo: 4,
    from: username,
    name: 'Aino',
    subject: 'October weekend in Turku',
    text: 'I can take the 09:37 train on Saturday. Want to meet by the station and walk over together? I found a few lunch places near the river that take bookings.',
    folder: 'sent',
    seen: true,
  },
  {
    id: 'home-repair',
    daysAgo: 3,
    from: 'service@talohuolto.example',
    name: 'Talohuolto',
    subject: 'Water shutoff on Wednesday morning',
    text: 'The building’s hot water will be unavailable on Wednesday, 6 November, between 09:00 and 11:30 while a valve is replaced. Cold water will remain available. Please clear the cabinet under your kitchen sink.',
  },
  {
    id: 'sade-reply',
    daysAgo: 3,
    from: 'sade.korhonen@example.test',
    name: 'Säde Korhonen',
    subject: 'Re: Mummo’s birthday photos 🎂',
    text: 'Löysin vielä yhden kuvan! Äiti nauraa taustalla, ja mummo näyttää siltä kuin olisi jo huomannut kakun suklaan puuttuvan. Tämä pitää kehystää 😄',
    replyTo: '<family-photo@seed.ink>',
    references: ['<family-photo@seed.ink>'],
    seen: true,
  },
  {
    id: 'museum',
    daysAgo: 2,
    from: 'news@amuseum.example',
    name: 'A Museum',
    subject: 'Sunday studio hours at the Design Museum',
    text: 'The workshop is open this Sunday from 12:00 to 16:00. Drop in to try paper marbling, see the new furniture archive display, or join the short curator tour at 14:00. No booking is needed.',
    flagged: true,
  },
  {
    id: 'parcel',
    daysAgo: 2,
    from: 'tracking@posti.example',
    name: 'Posti',
    subject: 'Your parcel is ready for pickup',
    text: 'Pakettisi AB123456789FI on noudettavissa K-Market Hakaniemestä. Ota mukaan henkilöllisyystodistus. Säilytämme pakettia 7 päivää.',
  },
  {
    id: 'customer-feedback',
    daysAgo: 1,
    from: 'oliver@northstar.studio',
    name: 'Oliver Berg',
    subject: 'A note from the first launch customer',
    text: 'The new signup flow worked well on my phone, and the confirmation arrived almost immediately. They did ask if we can add a way to update their billing email without contacting support. I added the request to the backlog.',
  },
  {
    id: 'weekend-list',
    daysAgo: 1,
    from: 'editor@weekendlist.example',
    name: 'Weekend List',
    subject: 'Three good plans for this weekend',
    text: 'A photography walk through Katajanokka on Saturday, a small ceramics fair at Cable Factory, and a free chamber concert at the old church on Sunday afternoon. The ceramics fair opens at 11:00.',
    html: '<div style="font-family:Arial,sans-serif;background:#f5efe7;padding:24px;color:#37312c"><small>WEEKEND LIST · HELSINKI</small><h1>Three good plans</h1><p>Photography walk · Katajanokka · Saturday 10:00</p><p>Ceramics fair · Cable Factory · Saturday 11:00</p><p>Chamber concert · Old Church · Sunday 15:00</p><img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=720" alt="Colourful art supplies" style="width:100%;border-radius:12px"></div>',
  },
  {
    id: 'budget',
    daysAgo: 0,
    from: 'finance@northstar.studio',
    name: 'Northstar Finance',
    subject: 'October studio expenses are ready',
    text: 'The October expense summary is ready for review. We have matched the print shop invoice and the two travel receipts. Please send any remaining receipts to finance by Friday at noon.',
    seen: true,
    folder: 'archive',
  },
  {
    id: 'winter-light',
    daysAgo: 0,
    from: 'aino@ink.test',
    name: 'Aino Korhonen',
    subject: 'A small reminder to bring the reflective vest',
    text: 'The mornings are dark again. I put the reflective vest by the front door and charged the bike light. See you at the waterfront café around eight?',
    folder: 'sent',
    seen: true,
  },
  {
    id: 'neighbourhood',
    daysAgo: 0,
    from: 'news@kalasatama.example',
    name: 'Kalasatama Neighbourhood',
    subject: 'Community room hours for November',
    text: 'The shared room is open for drop-ins on Tuesdays from 17:30 to 20:00. This month’s repair table is on the 12th; bring a lamp, a small appliance, or a jacket that needs a new button.',
  },
  {
    id: 'last-newsletter',
    daysAgo: 0,
    from: 'notes@slowmorning.example',
    name: 'Slow Morning',
    subject: 'The November reading table',
    text: 'A few pages for a slower month: a collection of letters from the archipelago, a practical guide to growing herbs on a balcony, and a new translation of Tove Jansson’s travel essays.',
    html: '<div style="max-width:620px;margin:auto;background:#f4f0e7;color:#2b332b;font:17px/1.6 Georgia,serif;padding:26px"><div style="color:#57715e;letter-spacing:2px;font:12px Arial,sans-serif">SLOW MORNING · NOVEMBER</div><h1 style="font-size:34px">The reading table</h1><img src="https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=720" alt="Books stacked on a wooden table" style="width:100%;border-radius:12px"><p>Letters from the archipelago, balcony herbs, and a new translation of Tove Jansson’s travel essays.</p><a href="https://slowmorning.example/reading-table">Browse the list</a></div>',
  },
  {
    id: 'clinic-reminder',
    daysAgo: 0,
    from: 'appointments@terveysasema.example',
    name: 'Kallio Health Centre',
    subject: 'Appointment reminder for Friday',
    text: 'You have an appointment on Friday, 8 November at 10:20 with the nurse at Kallio Health Centre, 2nd floor. Please bring your Kela card. To reschedule, call 09 310 12345.',
    seen: true,
  },
]

function encodeHeader(value: string): string {
  return /[^\x20-\x7e]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
    : value
}

function mimeAddress(name: string, email: string): string {
  const encodedName = encodeHeader(name)
  return encodedName ? `${encodedName} <${email}>` : email
}

function base64Lines(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? ''
}

function makeRawMessage(message: SeedMessage, index: number, receivedAt: string): string {
  const messageId = `<${message.id}@seed.ink>`
  const headers = [
    `From: ${mimeAddress(message.name, message.from)}`,
    `To: Aino Korhonen <${username}>`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date(receivedAt).toUTCString()}`,
    `Message-ID: ${messageId}`,
    ...(message.replyTo ? [`In-Reply-To: ${message.replyTo}`] : []),
    ...(message.references?.length ? [`References: ${message.references.join(' ')}`] : []),
    'MIME-Version: 1.0',
    'X-Mailer: Ink seed sample',
  ]

  const textPart = `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${message.text}\r\n`
  const htmlPart = message.html
    ? `Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${message.html}\r\n`
    : ''
  if (message.attachments?.length) {
    const outer = `seed-mixed-${index}`
    const alternative = `seed-alt-${index}`
    const parts = [
      `--${outer}\r\nContent-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n--${alternative}\r\n${textPart}${htmlPart ? `--${alternative}\r\n${htmlPart}` : ''}--${alternative}--\r\n`,
      ...message.attachments.map((attachment) =>
        `--${outer}\r\nContent-Type: ${attachment.type}; name="${attachment.name}"\r\nContent-Disposition: attachment; filename="${attachment.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(attachment.bytes)}\r\n`,
      ),
    ]
    return `${headers.join('\r\n')}\r\nContent-Type: multipart/mixed; boundary="${outer}"\r\n\r\n${parts.join('')}--${outer}--\r\n`
  }
  if (htmlPart) {
    const boundary = `seed-alt-${index}`
    return `${headers.join('\r\n')}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\n${textPart}--${boundary}\r\n${htmlPart}--${boundary}--\r\n`
  }
  return `${headers.join('\r\n')}\r\n${textPart}`
}

function selectMailbox(mailboxes: Awaited<ReturnType<JmapClient['getMailboxes']>>, role: string, name: string): string {
  const mailbox = mailboxes.find((entry) => entry.role === role)
    ?? mailboxes.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
  if (!mailbox) throw new Error(`Required mailbox is missing: ${name}`)
  return mailbox.id
}

let mailboxes = await client.getMailboxes()
if (!mailboxes.some((mailbox) => mailbox.role === 'archive' || mailbox.name.toLowerCase() === 'archive')) {
  const [response] = await client.request([
    ['Mailbox/set', {
      accountId: client.accountId,
      create: { archive: { name: 'Archive', role: 'archive' } },
    }, 'createArchive'],
  ])
  const created = response?.[1].created as Record<string, { id?: string }> | undefined
  if (!created?.archive?.id) {
    const [fallback] = await client.request([
      ['Mailbox/set', {
        accountId: client.accountId,
        create: { archive: { name: 'Archive' } },
      }, 'createArchiveFallback'],
    ])
    const fallbackCreated = fallback?.[1].created as Record<string, { id?: string }> | undefined
    if (!fallbackCreated?.archive?.id) {
      const issue = (fallback?.[1].notCreated as Record<string, { description?: string }> | undefined)
        ?.archive
      throw new Error(`Could not create Archive mailbox: ${issue?.description ?? 'unknown error'}`)
    }
  }
  mailboxes = await client.getMailboxes()
}
const inboxId = selectMailbox(mailboxes, 'inbox', 'Inbox')
const archiveId = selectMailbox(mailboxes, 'archive', 'Archive')
const sentId = selectMailbox(mailboxes, 'sent', 'Sent')
const inbox = await client.queryEmails({ mailboxId: inboxId, limit: 1 })
if (inbox.total > 20 && !force) {
  console.log(`Seed skipped: Inbox already has ${inbox.total} messages (use --force to add samples).`)
} else {
  const imports: Record<string, Record<string, unknown>> = {}
  for (const [index, message] of messages.entries()) {
    const receivedAt = new Date(Date.now() - message.daysAgo * 86_400_000 - (index % 9) * 3_600_000)
      .toISOString()
    const uploaded = await client.upload(new Blob(
      [makeRawMessage(message, index, receivedAt)],
      { type: 'message/rfc822' },
    ))
    const mailboxId = message.folder === 'archive'
      ? archiveId
      : message.folder === 'sent'
        ? sentId
        : inboxId
    imports[`seed-${index}`] = {
      blobId: uploaded.blobId,
      mailboxIds: { [mailboxId]: true },
      keywords: {
        ...(message.seen ? { '$seen': true } : {}),
        ...(message.flagged ? { '$flagged': true } : {}),
      },
      receivedAt,
    }
  }

  const entries = Object.entries(imports)
  for (let start = 0; start < entries.length; start += 15) {
    const batch = Object.fromEntries(entries.slice(start, start + 15))
    const [response] = await client.request([
      ['Email/import', { accountId: client.accountId, emails: batch }, `import-${start}`],
    ])
    const args = response?.[1] ?? {}
    const notCreated = args.notCreated as Record<string, unknown> | undefined
    if (notCreated && Object.keys(notCreated).length > 0) {
      const failures = Object.entries(notCreated)
        .map(([id, error]) => `${id}: ${(error as { description?: string }).description ?? 'import failed'}`)
      throw new Error(`Email import failed: ${failures.join('; ')}`)
    }
  }
  console.log(`Seeded ${messages.length} realistic messages across Inbox, Archive, and Sent.`)
}
