import { describe, it, expect } from 'vitest'
import { isDirectConfig, isBackendConfig } from '../src/types'
import type { SeamlessConfig } from '../src/types'

describe('isDirectConfig', () => {
  it('returns true when apiKey and apiPassword are present', () => {
    const config = {
      apiKey: 'sk_test_abc',
      apiPassword: 'password',
      country: 'CI',
      merchantTransactionId: 'TX-1',
      amount: 500,
      currency: 'XOF',
      designation: 'Test',
      notifyUrl: 'https://example.com/webhook',
      successUrl: 'https://example.com/success',
      failedUrl: 'https://example.com/failed',
      clientEmail: 'test@test.com',
      clientFirstName: 'Jean',
      clientLastName: 'Dupont',
    } as SeamlessConfig
    expect(isDirectConfig(config)).toBe(true)
  })

  it('returns false when only apiKey without apiPassword', () => {
    const config = { apiKey: 'sk_test_abc' } as unknown as SeamlessConfig
    expect(isDirectConfig(config)).toBe(false)
  })

  it('returns false when paymentToken is present', () => {
    const config = { paymentToken: 'token-abc' } as SeamlessConfig
    expect(isDirectConfig(config)).toBe(false)
  })
})

describe('isBackendConfig', () => {
  it('returns true when paymentToken is present', () => {
    const config = { paymentToken: 'token-abc' } as SeamlessConfig
    expect(isBackendConfig(config)).toBe(true)
  })

  it('returns false when apiKey is present', () => {
    const config = {
      apiKey: 'sk_test_abc',
      apiPassword: 'pass',
      country: 'CI',
      merchantTransactionId: 'TX-1',
      amount: 500,
      currency: 'XOF',
      designation: 'Test',
      notifyUrl: 'https://example.com/webhook',
      successUrl: 'https://example.com/success',
      failedUrl: 'https://example.com/failed',
      clientEmail: 'test@test.com',
      clientFirstName: 'Jean',
      clientLastName: 'Dupont',
    } as SeamlessConfig
    expect(isBackendConfig(config)).toBe(false)
  })
})
