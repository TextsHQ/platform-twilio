import React, { useState, useEffect } from 'react'
import type { AuthProps } from '@textshq/platform-sdk'
import PhoneInput from 'react-phone-number-input/input'
import { isPossiblePhoneNumber } from 'react-phone-number-input'

const TwilioAuth: React.FC<AuthProps> = ({ login, api }) => {
  const [loading, setLoading] = useState(true)
  const [twilioNumber, setTwilioNumber] = useState('')
  const [twilioToken, setTwilioToken] = useState('')
  const [twilioSid, setTwilioSid] = useState('')

  const onSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    await login({ custom: { twilioNumber, twilioToken, twilioSid } })
    setLoading(false)
  }

  useEffect(() => {
    api.onLoginEvent(done => {
      if (done) onSubmit().catch(console.error)
    })
  }, [api])

  return (
    <div className="auth twilio-auth">
      <form onSubmit={onSubmit}>
        <label>
          <span>Twilio Number</span>
          <PhoneInput onChange={value => setTwilioNumber(value ? value.toString() : '')} value={twilioNumber} autoFocus />
        </label>
        <label>
          <span>Twilio Auth Token</span>
          <input onChange={value => setTwilioToken(value ? value.toString() : '')} value={twilioToken} autoFocus />
        </label>
        <label>
          <span>Twilio SID</span>
          <input onChange={value => setTwilioSid(value ? value.toString() : '')} value={twilioSid} autoFocus />
        </label>
        <label>
          <button type="submit" disabled={!isPossiblePhoneNumber(twilioNumber || '') || loading}>{loading ? '...' : '→'}</button>
        </label>
      </form>
    </div>
  )
}

export default TwilioAuth
