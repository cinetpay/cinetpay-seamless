import { describe, it, expect } from 'vitest'
import { isDirectConfig, isBackendConfig } from '../src/types'
import type { SeamlessConfig } from '../src/types'

describe('isDirectConfig', () => {
  it('returns true when apiKey is present', () => {
    const config = {
      apiKey: 'sk_test_abc',
      siteId: 123,
      transactionId: 'TX-1',
      amount: 500,
      currency: 'XOF',
      description: 'Test',
      notifyUrl: 'https://example.com/webhook',
    } as SeamlessConfig
    expect(isDirectConfig(config)).toBe(true)
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
      siteId: 123,
      transactionId: 'TX-1',
      amount: 500,
      currency: 'XOF',
      description: 'Test',
      notifyUrl: 'https://example.com/webhook',
    } as SeamlessConfig
    expect(isBackendConfig(config)).toBe(false)
  })
})
