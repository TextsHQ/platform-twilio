import {
  AccountInfo,
  ActivityType,
  Awaitable,
  FetchInfo, InboxName,
  LoginCreds,
  LoginResult,
  Message,
  MessageContent,
  OnServerEventCallback,
  Paginated,
  PaginationArg,
  Participant,
  PlatformAPI,
  SerializedSession,
  ServerEventType,
  texts,
  Thread, ThreadFolderName,
  User,
} from '@textshq/platform-sdk'
import type { Readable } from 'stream'
import path from 'path'
import { promises as fsp } from 'fs'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import TwilioAPI from './network-api'
import { TwilioMessageDB } from './message-db'
import { mapMessage, mapMessagesToObjects } from './mappers'

const { IS_DEV } = texts

if (IS_DEV) {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  require('source-map-support').install()
}

export default class PlatformTwilio implements PlatformAPI {
  private accountInfo: AccountInfo

  private loginEventCallback?: any

  private api = new TwilioAPI()

  private messageDb: TwilioMessageDB

  disposed = false

  onServerEvent: OnServerEventCallback

  private pullRecentMessages = async (): Promise<MessageInstance[]> => {
    const mostRecentMessageDate = this.messageDb.getLastTimestamp()
    const newMessages = await this.api.getMessagesOfNumber(mostRecentMessageDate)
    if (newMessages.length > 0) {
      await this.messageDb.storeMessages(newMessages, await this.getCurrentUser())
    }
    return newMessages
  }

  init = async (session: SerializedSession, accountInfo: AccountInfo) => {
    this.accountInfo = accountInfo

    const dbPath = path.join(accountInfo.dataDirPath, 'db.sqlite')
    this.messageDb = new TwilioMessageDB({ dbPath })
    await this.messageDb.init()

    if (!session) {
      texts.error('No session in Twilio init()!')
      return
    }

    await this.api.login(session.sid, session.token, session.number)
    await this.pullRecentMessages()
  }

  private pollTimeout: NodeJS.Timeout

  private lastUserUpdatesFetch: number

  private pollUserUpdates = async (): Promise<Thread[]> => {
    clearTimeout(this.pollTimeout)
    if (this.disposed) return
    // 8 seconds for now for refreshing user updates
    let nextFetchTimeoutMs = 8_000
    let messages: MessageInstance[] = []
    try {
      messages = await this.pullRecentMessages()
      this.lastUserUpdatesFetch = Date.now()
    } catch (err) {
      nextFetchTimeoutMs = 60_000
    }

    if (this.onServerEvent && messages.length > 0) {
      const currentUser = await this.getCurrentUser()
      const messageObjects = mapMessagesToObjects(messages, currentUser)
      for (const messageObject of messageObjects) {
        const message = mapMessage(messageObject, currentUser)
        this.onServerEvent([{
          type: ServerEventType.STATE_SYNC,
          mutationType: 'upsert',
          objectName: 'message',
          objectIDs: { threadID: message.threadID },
          entries: [message],
        }])
      }
    }

    this.pollTimeout = setTimeout(this.pollUserUpdates, nextFetchTimeoutMs)
  }

  subscribeToEvents = async (onEvent: OnServerEventCallback): Promise<void> => {
    this.onServerEvent = onEvent
    this.pollUserUpdates()
  }

  dispose = () => {
    this.disposed = true
    clearTimeout(this.pollTimeout)
  }

  reconnectRealtime = () => {
    if ((Date.now() - this.lastUserUpdatesFetch) > 5_000) this.pollUserUpdates()
  }

  getCurrentUser = () => this.api.getCurrentUser()

  login = async ({ jsCodeResult }: LoginCreds): Promise<LoginResult> => {
    // Make sure we have SID, token and number scraped from user login
    if (!jsCodeResult) return { type: 'error', errorMessage: 'jsCodeResult was false for Twilio' }
    const { sid, token, number } = JSON.parse(jsCodeResult)
    await this.api.login(sid, token, number)

    // Do initial pull of all messages and save to local DB
    const messages = await this.api.getMessagesOfNumber()
    const user = await this.api.getCurrentUser()
    await this.messageDb.storeMessages(messages, user)

    return { type: 'success' }
  }

  private deleteAssetsDir = async () => {
    await fsp.rm(this.accountInfo.dataDirPath, { recursive: true })
  }

  logout = async () => {
    await this.deleteAssetsDir()
  }

  serializeSession = () => ({
    sid: this.api.sid,
    token: this.api.token,
    number: this.api.number,
  })

  onLoginEvent = (onEvent: Function) => {
    this.loginEventCallback = onEvent
  }

  getThreads = async (inboxName: ThreadFolderName, pagination: PaginationArg): Promise<Paginated<Thread>> => {
    if (inboxName !== InboxName.NORMAL) return

    const { cursor } = pagination || { cursor: null, direction: null }
    const index = cursor ? (+cursor || 0) : 0
    const limit = 20

    const currentUser = await this.api.getCurrentUser()
    // we only have a messages table for now, so we need to get all threads
    // and then .slice() them instead of querying directly via the limit & offset
    const mappedThreads = (await this.messageDb.getAllThreads(currentUser))
      .slice(index, index + limit)
    return {
      items: mappedThreads,
      hasMore: mappedThreads.length >= limit,
      oldestCursor: (index + limit).toString(),
    }
  }

  getMessages = async (
    threadID: string,
    pagination?: PaginationArg,
  ) => {
    const { cursor } = pagination || { cursor: null, direction: null }
    const cursorTimestamp = cursor
      ? await this.messageDb.getTimestampFromCursor(threadID, cursor)
      : (await this.messageDb.getLastTimestamp()).getTime()
    const limit = 20

    const currentUser = await this.api.getCurrentUser()
    const mappedMessages = await this.messageDb.getMessagesByThread(
      threadID,
      currentUser,
      limit,
      cursorTimestamp,
    )
    return {
      items: mappedMessages,
      hasMore: mappedMessages.length >= limit,
      oldestCursor: cursor,
    }
  }

  getThreadParticipants?: (
    threadID: string,
    pagination?: PaginationArg
  ) => Awaitable<Paginated<Participant>>

  getThread?: (threadID: string) => Awaitable<Thread>

  getMessage?: (messageID: string) => Awaitable<Message>

  getUser?: (
    ids:
    | { userID?: string }
    | { username?: string }
    | { phoneNumber?: string }
    | { email?: string }
  ) => Awaitable<User>

  createThread: (
    userIDs: string[],
    title?: string,
    messageText?: string
  ) => Awaitable<boolean | Thread>

  updateThread?: (threadID: string, updates: Partial<Thread>) => Awaitable<void>

  deleteThread?: (threadID: string) => Awaitable<void>

  sendMessage = async (
    threadID: string,
    msgContent: MessageContent,
  ): Promise<boolean | Message[]> => {
    const { text } = msgContent
    const message = await this.api.sendMessage(threadID, text)
    return message ? [message] : false
  }

  sendReadReceipt = async (threadID: string, messageID: string) => {
    const currentUser = await this.api.getCurrentUser()
    const message = await this.messageDb.getMessageById(messageID, currentUser)
    await this.messageDb.readMessages(threadID, message.timestamp)
  }

  archiveThread?: (threadID: string, archived: boolean) => Awaitable<void>

  pinThread?: (threadID: string, pinned: boolean) => Awaitable<void>

  notifyAnyway?: (threadID: string) => Awaitable<void>

  onThreadSelected?: (threadID: string) => Awaitable<void>

  getAsset?: (
    _,
    ...args: string[]
  ) => Awaitable<string | Buffer | FetchInfo | Readable>

  getOriginalObject?: (
    objName: 'thread' | 'message',
    objectID: string
  ) => Awaitable<string>

  handleDeepLink?: (link: string) => void

  sendActivityIndicator: (
    type: ActivityType,
    threadID?: string
  ) => Awaitable<void>

  searchUsers: (typed: string) => Awaitable<User[]>
}
