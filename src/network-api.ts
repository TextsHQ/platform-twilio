import { Twilio } from 'twilio'
import type { CurrentUser, Paginated, Thread } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { md5 } from './util'
import { mapThreads } from './mappers'

export default class TwilioAPI {
  private client?: Twilio

  sid?: string

  token?: string

  number?: string

  currentUser?: CurrentUser

  // helper function to get messages from and to the account number
  getMessagesOfNumber = async (): Promise<MessageInstance[]> => {
    const fromMessages = await this.client?.messages.list({ from: this.number })
    const toMessages = await this.client?.messages.list({ to: this.number })
    return [...fromMessages, ...toMessages]
      .sort((a, b) =>
        a.dateCreated.getTime() - b.dateCreated.getTime())
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

  getThreads = async (): Promise<Paginated<Thread>> => {
    const messages = await this.getMessagesOfNumber()
    const threads = mapThreads(messages, this.currentUser)
    return {
      hasMore: false,
      items: threads,
    }
  }
}
