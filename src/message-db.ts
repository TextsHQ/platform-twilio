// eslint-disable-next-line import/no-extraneous-dependencies
import Database, { Statement } from 'better-sqlite3'
import { promises as fsp } from 'fs'
import { dirname } from 'path'
import { Message, Paginated, texts, Thread, User } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { mapMessages, mapThreads } from './mappers'

export interface MessageObject {
  id: string
  body: string
  otherParticipant: string
  isSender: boolean
  timestamp: number
}

export class TwilioMessageDB {
  private twilioSchema = `
    CREATE TABLE messages (
      "id" TEXT not null primary key,
      "body" TEXT not null,
      "otherParticipant" VARCHAR(16) not null,
      "isSender" BOOLEAN not null,
      "timestamp" INTEGER not null
    );`

  private db: Database.Database

  private readonly dbPath: string

  private statementCache: Map<string, Statement>

  constructor({ dbPath }: { dbPath: string }) {
    this.dbPath = dbPath
    this.statementCache = new Map<string, Statement>()
  }

  private prepareCache = (sql: string): Statement => {
    if (!this.statementCache.has(sql)) {
      this.statementCache.set(sql, this.db.prepare(sql))
    }
    return this.statementCache.get(sql)
  }

  private createTables = async () => {
    this.db.exec(this.twilioSchema)
    this.db.pragma('user_version = 1')
  }

  async init() {
    try {
      await fsp.stat(dirname(this.dbPath))
    } catch {
      await fsp.mkdir(dirname(this.dbPath))
    }
    this.db = new Database(this.dbPath, {})
    texts.log(`load DB path: ${this.dbPath}`)
    if (
      !(this.prepareCache(
        'select name from sqlite_master where type = ? and name = ?',
      ).get('table', 'messages'))
    ) {
      await this.createTables()
    }
  }

  storeMessages = (messages: MessageInstance[], currentUser: string) => {
    const insertMessage = this.prepareCache(
      'insert or replace into messages (id, body, otherParticipant, isSender, timestamp) values (?, ?, ?, ?, ?)',
    )
    for (const message of messages) {
      const otherParticipant = message.from === currentUser ? message.to : message.from
      const isSender = message.from === currentUser
      texts.log('twilio store messages: ', message.sid, message.body, otherParticipant, isSender, message.dateCreated)
      insertMessage.run(
        message.sid,
        message.body,
        otherParticipant,
        isSender ? 1 : 0,
        message.dateCreated.getTime(),
      )
    }
  }

  getLastTimestamp = (): Date => {
    const { timestamp } = this.prepareCache('select max(timestamp) as timestamp from messages').get()
    return timestamp
  }

  getAllThreads = async (currentUser: User): Promise<Paginated<Thread>> => {
    const threads: MessageObject[] = this.prepareCache(
      'select * from messages',
    ).all()
    const mappedThreads = mapThreads(threads, currentUser)
    return {
      hasMore: false,
      items: mappedThreads,
    }
  }

  getMessagesByThread = async (threadId: string, currentUser: User): Promise<Paginated<Message>> => {
    const messages: MessageObject[] = this.prepareCache(
      'select * from messages where otherParticipant = ?',
    ).all(threadId)
    const mappedMessages = mapMessages(messages, currentUser)
    return {
      hasMore: false,
      items: mappedMessages,
    }
  }
}
