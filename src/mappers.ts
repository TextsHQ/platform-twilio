import type { Message, Thread, User } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { md5 } from './util'

// We want to make {from: '+123', to: '+456'} and {from: '+456', to: '+123'}
// to be the same thread, so they should have the same ID
const getThreadId = (message: MessageInstance) => {
  const { from, to } = message
  return from > to ? md5(`${from},${to}`) : md5(`${to},${from}`)
}

export function mapMessage(message: MessageInstance, currentUserId: string): Message {
  const mapped: Message = {
    _original: JSON.stringify([message]),
    id: message.sid,
    timestamp: new Date(+message.dateCreated),
    threadID: getThreadId(message),
    senderID: md5(message.from),
    isSender: md5(message.from) === currentUserId,
    text: message.body,
  }

  return mapped
}

// Twilio API only returns a raw log of messages, so we need to infer threads
// from them (from & to pairings) and then map them to the Thread interface
export function mapThreads(messages: MessageInstance[], currentUser: User): Thread[] {
  const threadToMessageMapping: Map<string, Message[]> = new Map()
  for (const message of messages) {
    const threadId = getThreadId(message)
    const threadMessages = threadToMessageMapping.get(threadId) || []
    threadToMessageMapping.set(threadId, [...threadMessages, mapMessage(message, currentUser.id)])
  }
  const threads = []
  for (const [threadId, threadMessages] of threadToMessageMapping) {
    threadMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    // TODO figure out how to get other participant in the thread
    const participants: User[] = [currentUser]
    const thread: Thread = {
      id: threadId,
      isUnread: true,
      isReadOnly: false,
      participants: {
        hasMore: false,
        items: participants,
      },
      messages: {
        hasMore: false,
        items: threadMessages,
      },
      // we only support 1-1 messaging on twilio for now
      type: 'single',
    }
    threads.push(thread)
  }
  return threads
}
