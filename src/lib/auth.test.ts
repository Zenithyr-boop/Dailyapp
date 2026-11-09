import { authErrorMessage } from './auth'

describe('authErrorMessage', () => {
  it('maps known Firebase codes to short messages', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe('Email or password is wrong.')
    expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/already an account/)
    expect(authErrorMessage({ code: 'auth/weak-password' })).toMatch(/at least 6/)
  })

  it('stays quiet when the user closes the Google popup', () => {
    expect(authErrorMessage({ code: 'auth/popup-closed-by-user' })).toBeNull()
    expect(authErrorMessage({ code: 'auth/cancelled-popup-request' })).toBeNull()
  })

  it('falls back to a generic message', () => {
    expect(authErrorMessage(new Error('boom'))).toBe('Something went wrong. Try again.')
    expect(authErrorMessage(undefined)).toBe('Something went wrong. Try again.')
  })
})
