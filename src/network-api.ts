import crypto from 'crypto'
import { Twilio } from 'twilio'
import type { CurrentUser } from '@textshq/platform-sdk'

export default class TwilioAPI {
  private client?: Twilio

  sid?: string

  token?: string

  number?: string

  currentUser?: CurrentUser

  md5 = (str: string) =>
    crypto.createHash('md5').update(str).digest('hex')

  login = async (sid: string, token: string, number: string) => {
    this.sid = sid
    this.token = token
    this.number = number
    this.client = new Twilio(sid, token)
  }

  getCurrentUser = async (): Promise<CurrentUser> => {
    const currentUser = {
      displayText: this.number || 'Twilio',
      id: this.md5(this.number),
      phoneNumber: this.number,
      username: this.number,
      isSelf: true,
    }
    this.currentUser = currentUser
    return currentUser
  }
}
