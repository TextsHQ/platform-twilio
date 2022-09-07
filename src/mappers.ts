import type { Message, Thread, User } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { md5 } from './util'
import type { MessageObject } from './message-db'

export function mapMessage(message: MessageObject, currentUser: User): Message {
  // edge case for when we're querying messages not read yet
  if (message?.id === undefined) {
    return null
  }
  return {
    _original: JSON.stringify([message]),
    id: message.id,
    timestamp: new Date(+message.timestamp),
    threadID: message.otherParticipant,
    isSender: message.isSender,
    seen: message.isRead,
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
      isRead: false,
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
