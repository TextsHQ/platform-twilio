import type { Message, Thread, User } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { md5 } from './util'
import type { MessageObject } from './message-db'

// We want to make {from: '+123', to: '+456'} and {from: '+456', to: '+123'}
// to be the same thread, so they should have the same ID
// export const getThreadId = (currentUser: string, otherParticipant: string) => md5(`${currentUser},${otherParticipant}`)

export function mapMessage(message: MessageObject, currentUser: User): Message {
  return {
    _original: JSON.stringify([message]),
    id: message.id,
    timestamp: new Date(+message.timestamp),
    threadID: message.otherParticipant,
    isSender: message.isSender,
    senderID: message.isSender ? currentUser.id : md5(message.otherParticipant),
    text: message.body,
  }
}

export function mapMessages(messages: MessageObject[], currentUser: User): Message[] {
  const mappedMessages = []
  for (const message of messages) {
    mappedMessages.push(mapMessage(message, currentUser))
  }
  return mappedMessages
}

export function mapMessagesToObjects(messages: MessageInstance[], currentUser: User): MessageObject[] {
  const messageObjects = []
  for (const message of messages) {
    const otherParticipant = message.from === currentUser.phoneNumber ? message.to : message.from
    const isSender = message.from === currentUser.phoneNumber
    messageObjects.push({
      id: message.sid,
      body: message.body,
      otherParticipant,
      isSender,
      timestamp: message.dateSent.getTime(),
    })
  }
  return messageObjects
}

export function mapThreads(messages: MessageObject[], currentUser: User): Thread[] {
  const threadToMessageMapping: Map<string, [Message[], string]> = new Map()
  for (const message of messages) {
    const threadId = message.otherParticipant
    const threadMessages = threadToMessageMapping.get(threadId) || [[], message.otherParticipant]
    threadToMessageMapping.set(threadId, [[...threadMessages[0], mapMessage(message, currentUser)], message.otherParticipant])
  }
  const threads = []
  for (const [threadId, threadMessages] of threadToMessageMapping) {
    threadMessages[0].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const otherParticipant = threadMessages[1]
    const otherParticipantUser: User = {
      id: md5(otherParticipant),
      phoneNumber: otherParticipant,
      username: otherParticipant,
      isSelf: false,
    }
    const participants: User[] = [currentUser, otherParticipantUser]
    const thread: Thread = {
      title: otherParticipant,
      id: threadId,
      isUnread: true,
      isReadOnly: false,
      participants: {
        hasMore: false,
        items: participants,
      },
      messages: {
        hasMore: false,
        items: threadMessages[0],
      },
      // we only support 1-1 messaging on twilio for now
      type: 'single',
    }
    threads.push(thread)
  }
  return threads
}
