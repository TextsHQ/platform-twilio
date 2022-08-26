import { PlatformInfo, MessageDeletionMode } from '@textshq/platform-sdk'

const onNavigate = `
(async () => {
  window.__twilioApiCreds = {}
  if (window.location.href.includes('https://console.twilio.com/')) {
  setTimeout(() => { console.log('waiting a few seconds for twilio creds...'), 2000 })
  var buttons = document.getElementsByTagName('button')
    for(var i = 0; i < buttons.length; i++) {
      if(buttons[i].dataset.testid == 'auth-token-toggle-btn') {
          buttons[i].click()
          break
      }
    }
    const sid = document.getElementById('account-sid').value
    const token = document.getElementById('auth-token').value
    const number = document.getElementById('phone-number').value
    console.log(sid, token, number)

    if(sid && token && number && token.indexOf('---') === -1) {
      setTimeout(() => window.close(), 100)
    }
  }
})()
`

const info: PlatformInfo = {
  name: 'twilio',
  version: '0.0.1',
  tags: ['Beta'],
  displayName: 'Twilio',
  icon: '<svg width="1em" height="1em" style="color: red" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    + '<title>Twilio</title>'
    + '<path d="M12 0C5.381-.008.008 5.352 0 11.971V12c0 6.64 5.359 12 12 12 6.64 0 12-5.36 12-12 0-6.641-5.36-12-12-12zm0 20.801c-4.846.015-8.786-3.904-8.801-8.75V12c-.014-4.846 3.904-8.786 8.75-8.801H12c4.847-.014 8.786 3.904 8.801 8.75V12c.015 4.847-3.904 8.786-8.75 8.801H12zm5.44-11.76c0 1.359-1.12 2.479-2.481 2.479-1.366-.007-2.472-1.113-2.479-2.479 0-1.361 1.12-2.481 2.479-2.481 1.361 0 2.481 1.12 2.481 2.481zm0 5.919c0 1.36-1.12 2.48-2.481 2.48-1.367-.008-2.473-1.114-2.479-2.48 0-1.359 1.12-2.479 2.479-2.479 1.361-.001 2.481 1.12 2.481 2.479zm-5.919 0c0 1.36-1.12 2.48-2.479 2.48-1.368-.007-2.475-1.113-2.481-2.48 0-1.359 1.12-2.479 2.481-2.479 1.358-.001 2.479 1.12 2.479 2.479zm0-5.919c0 1.359-1.12 2.479-2.479 2.479-1.367-.007-2.475-1.112-2.481-2.479 0-1.361 1.12-2.481 2.481-2.481 1.358 0 2.479 1.12 2.479 2.481z" fill="red"></path>'
    + '</svg>',
  loginMode: 'browser',
  browserLogins: [{
    loginURL: 'https://twilio.com/login',
    // authCookieName: 'server-identity',
    runJSOnLaunch: 'window.__twilioApiCreds = {}',
    runJSOnNavigate: onNavigate,
    runJSOnClose: 'JSON.stringify({\'a\':\'b\'})',
  }],
  deletionMode: MessageDeletionMode.UNSUPPORTED,
  attributes: new Set([]),
}

export default info
