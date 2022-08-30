import { Twilio } from 'twilio'
import type { CurrentUser, Message, Paginated } from '@textshq/platform-sdk'
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message'
import { md5 } from './util'

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
    const fromMessages = await this.client?.messages.list({ from: this.number, ...dateSentAfter })
    const toMessages = await this.client?.messages.list({ to: this.number, ...dateSentAfter })
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
}
