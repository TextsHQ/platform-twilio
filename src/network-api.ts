import { Twilio } from 'twilio'
import type { CurrentUser, Message } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { md5 } from './util'
import { mapMessage } from './mappers'
import type { MessageObject } from './message-db'

export default class TwilioAPI {
  private client?: Twilio

  sid?: string

  token?: string

  number?: string

  currentUser?: CurrentUser

  // Helper function to get messages from and to the account number
  // User may have multiple numbers for the same account
  // Optional parameter to filter by date for syncing over time
  getMessagesOfNumber = async (dateSentAfter?: Date): Promise<MessageInstance[]> => {
    const fromMessages = await this.client?.messages.list({ from: this.number, dateSentAfter })
    const toMessages = await this.client?.messages.list({ to: this.number, dateSentAfter })
    return [...fromMessages, ...toMessages]
      .sort((a, b) =>
        a.dateSent.getTime() - b.dateSent.getTime())
  }

  login = async (sid: string, token: string, number: string) => {
    this.sid = sid
    this.token = token
    this.number = number
    this.client = new Twilio(sid, token)
  }

  getCurrentUser = async (): Promise<CurrentUser> => {
    const currentUser = {
      displayText: this.number || 'Twilio',
      id: md5(this.number),
      phoneNumber: this.number,
      username: this.number,
      isSelf: true,
    }
    this.currentUser = currentUser
    return currentUser
  }

  sendMessage = async (threadId: string, text: string): Promise<Message> => {
    const message = await this.client.messages
      .create({ from: this.number, body: text, to: threadId })
    const messageObject: MessageObject = {
      id: message.sid,
      body: message.body,
      otherParticipant: message.to,
      isSender: true,
      // using dateCreated since dateSent isn't available until message is delivered
      timestamp: message.dateCreated.getTime(),
    }

    return mapMessage(messageObject, this.currentUser)
  }
}
