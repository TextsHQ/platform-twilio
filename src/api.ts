import {
  AccountInfo,
  ActivityType,
  Awaitable,
  CustomEmojiMap,
  FetchInfo,
  LoginCreds,
  LoginResult,
  Message,
  MessageContent,
  MessageLink,
  MessageSendOptions,
  OnConnStateChangeCallback,
  OnServerEventCallback,
  Paginated,
  PaginationArg,
  Participant,
  PlatformAPI,
  PresenceMap,
  SerializedSession,
  texts,
  Thread,
  User,
} from '@textshq/platform-sdk'
import type { Readable } from 'stream'
import TwilioAPI from './network-api'

const { IS_DEV } = texts

if (IS_DEV) {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  require('source-map-support').install()
}

export default class PlatformTwilio implements PlatformAPI {
  private accountInfo: AccountInfo

  private loginEventCallback?: any

  private api = new TwilioAPI()

  init = async (session: SerializedSession, accountInfo: AccountInfo) => {
    this.accountInfo = accountInfo

    if (!session) {
      texts.error('No session in Twilio init()!')
      return
    }

    await this.api.login(session.sid, session.token, session.number)

    texts.log('Twilio.init', { session, accountInfo })
  }

  dispose: () => Awaitable<void>

  getCurrentUser = () => this.api.getCurrentUser()

  login = async ({ jsCodeResult }: LoginCreds): Promise<LoginResult> => {
    texts.log('TWILIO_CREDS_CUSTOM', JSON.stringify(jsCodeResult, null, 4))
    if (!jsCodeResult) return { type: 'error', errorMessage: 'jsCodeResult was false for Twilio' }
    const { sid, token, number } = JSON.parse(jsCodeResult)
    await this.api.login(sid, token, number)
    return { type: 'success' }
  }

  logout?: () => Awaitable<void>

  serializeSession = () => ({
    sid: this.api.sid,
    token: this.api.token,
    number: this.api.number,
  })

  subscribeToEvents: (onEvent: OnServerEventCallback) => Awaitable<void>

  onLoginEvent = (onEvent: Function) => {
    this.loginEventCallback = onEvent
  }

  onConnectionStateChange?: (
    onEvent: OnConnStateChangeCallback
  ) => Awaitable<void>

  takeoverConflict?: () => Awaitable<void>

  searchUsers: (typed: string) => Awaitable<User[]>

  searchThreads?: (typed: string) => Awaitable<Thread[]>

  searchMessages?: (
    typed: string,
    pagination?: PaginationArg,
    threadID?: string
  ) => Awaitable<Paginated<Message>>

  getThreads: (
    folderName: string,
    pagination?: PaginationArg
  ) => Awaitable<Paginated<Thread>>

  getMessages: (
    threadID: string,
    pagination?: PaginationArg
  ) => Awaitable<Paginated<Message>>

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

  reportThread?: (
    type: 'spam',
    threadID: string,
    firstMessageID?: string
  ) => Awaitable<boolean>

  sendMessage?: (
    threadID: string,
    content: MessageContent,
    options?: MessageSendOptions
  ) => Promise<boolean | Message[]>

  forwardMessage?: (
    threadID: string,
    messageID: string,
    threadIDs?: string[],
    userIDs?: string[]
  ) => Promise<void>

  getLinkPreview?: (link: string) => Awaitable<MessageLink>

  changeThreadImage?: (
    threadID: string,
    imageBuffer: Buffer,
    mimeType: string
  ) => Awaitable<void>

  markAsUnread?: (threadID: string, messageID?: string) => Awaitable<void>

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

  /* Unimplemented via Twilio */
  getPresence?: () => Awaitable<PresenceMap>

  getCustomEmojis?: () => Awaitable<CustomEmojiMap>

  loadDynamicMessage?: (message: Message) => Awaitable<Partial<Message>>

  editMessage?: (
    threadID: string,
    messageID: string,
    content: MessageContent,
    options?: MessageSendOptions
  ) => Promise<boolean | Message[]>

  addParticipant?: (threadID: string, participantID: string) => Awaitable<void>

  removeParticipant?: (
    threadID: string,
    participantID: string
  ) => Awaitable<void>

  changeParticipantRole?: (
    threadID: string,
    participantID: string,
    role: string
  ) => Awaitable<void>

  sendActivityIndicator: (
    type: ActivityType,
    threadID?: string
  ) => Awaitable<void>

  deleteMessage?: (
    threadID: string,
    messageID: string,
    forEveryone?: boolean
  ) => Awaitable<void>

  sendReadReceipt: (
    threadID: string,
    messageID: string,
    messageCursor?: string
  ) => Awaitable<void>

  addReaction?: (
    threadID: string,
    messageID: string,
    reactionKey: string
  ) => Awaitable<void>

  removeReaction?: (
    threadID: string,
    messageID: string,
    reactionKey: string
  ) => Awaitable<void>

  onResumeFromSleep?: () => void
}
