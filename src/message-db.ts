// eslint-disable-next-line import/no-extraneous-dependencies
import Database, { Statement } from 'better-sqlite3'
import { promises as fsp } from 'fs'
import { dirname } from 'path'
import { Message, texts, Thread, User } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { mapMessage, mapMessages, mapMessagesToObjects, mapThreads } from './mappers'

export interface MessageObject {
  id: string
  body: string
  otherParticipant: string
  isSender: boolean
  isRead: boolean
  timestamp: number
}

export class TwilioMessageDB {
  private twilioSchema = `
    CREATE TABLE messages (
      "id" TEXT not null primary key,
      "body" TEXT not null,
      "otherParticipant" VARCHAR(16) not null,
      "isSender" BOOLEAN not null,
      "isRead" BOOLEAN not null default false,
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

  readMessages = async (threadId: string, date: Date) => {
    const readMessages = this.prepareCache('update messages set isRead = 1 where otherParticipant = ? and timestamp <= ?')
    readMessages.run(threadId, date.getTime())
  }

  storeMessages = (messages: MessageInstance[], currentUser: User) => {
    const insertMessage = this.prepareCache(
      'insert or replace into messages (id, body, otherParticipant, isSender, isRead, timestamp) values (?, ?, ?, ?, ?, ?)',
    )
    const messageObjects = mapMessagesToObjects(messages, currentUser)
    for (const message of messageObjects) {
      insertMessage.run(
        message.id,
        message.body,
        message.otherParticipant,
        message.isSender ? 1 : 0,
        message.isRead ? 1 : 0,
        message.timestamp,
      )
    }
  }

  getLatestMessageInThread = (threadId: string, currentUser: User): Message => {
    const getLatestMessage = this.prepareCache(
      'select * from messages where otherParticipant = ? order by timestamp desc limit 1',
    )
    const message = getLatestMessage.get(threadId)
    return mapMessage(message, currentUser)
  }

  getLastReadMessageInThread = (threadId: string, currentUser: User): Message => {
    const getLastReadMessage = this.prepareCache(
      'select * from messages where otherParticipant = ? and isRead = 1 order by timestamp desc limit 1',
    )
    const message = getLastReadMessage.get(threadId)
    texts.log('messageLOL', message)
    return mapMessage(message, currentUser)
  }

  getLastTimestamp = (): Date => {
    const { timestamp } = this.prepareCache('select max(timestamp) as timestamp from messages').get()
    // add 1 second to avoid duplicate messages with twilio DB
    return new Date(timestamp + 2000)
  }

  getAllThreads = async (currentUser: User): Promise<Thread[]> => {
    const messages: MessageObject[] = this.prepareCache(
      'select * from messages',
    ).all()
    const mappedThreads = mapThreads(messages, currentUser)
    for (const thread of mappedThreads) {
      const lastReadMessage = this.getLastReadMessageInThread(thread.id, currentUser)
      const lastMessageInThread = this.getLatestMessageInThread(thread.id, currentUser)
      thread.lastReadMessageID = lastReadMessage.id
      if (lastReadMessage.id === lastMessageInThread.id) {
        thread.isUnread = false
      }
    }
    return mappedThreads
  }

  getMessagesByThread = async (threadId: string, currentUser: User): Promise<Message[]> => {
    const messages: MessageObject[] = this.prepareCache(
      'select * from messages where otherParticipant = ?',
    ).all(threadId)
    return mapMessages(messages, currentUser)
  }

  getMessageById = async (messageId: string, currentUser: User): Promise<Message> => {
    const message: MessageObject = this.prepareCache(
      'select * from messages where id = ?',
    ).get(messageId)
    return mapMessage(message, currentUser)
  }
}
