import { Twilio } from 'twilio'

export default class TwilioAPI {
  private client?: Twilio

  sid?: string

  token?: string

  number?: string

  login = async (sid: string, token: string, number: string) => {
    this.sid = sid
    this.token = token
    this.number = number
    this.client = new Twilio(sid, token)
  }
}
