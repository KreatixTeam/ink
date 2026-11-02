export interface Mailbox {
  id: string
  name: string
  role: string | null
  parentId: string | null
  sortOrder: number
  totalEmails: number
  unreadEmails: number
  totalThreads: number
  unreadThreads: number
}

export interface EmailAddress {
  name: string | null
  email: string
}

export interface EmailSummary {
  id: string
  threadId: string
  mailboxIds: Record<string, true>
  keywords: Record<string, true>
  from: EmailAddress[]
  to: EmailAddress[]
  cc: EmailAddress[]
  subject: string
  preview: string
  receivedAt: string
  hasAttachment: boolean
  size: number
}

export interface Attachment {
  blobId: string
  name: string | null
  type: string
  size: number
  cid: string | null
  disposition: string | null
}

export interface EmailFull extends EmailSummary {
  bcc: EmailAddress[]
  replyTo: EmailAddress[]
  sentAt: string | null
  messageId: string[] | null
  inReplyTo: string[] | null
  references: string[] | null
  html: string | null
  text: string | null
  attachments: Attachment[]
}

export interface Identity {
  id: string
  name: string
  email: string
}

export interface StateChange {
  changed: Record<string, Record<string, string>>
}
