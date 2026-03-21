import { describe, it, expect } from 'vitest'
import type { SeamlessConfig, PaymentResponse, PaymentStatus } from '../src/types'

describe('SeamlessConfig type', () => {
  it('accepts valid config with paymentToken', () => {
    const config: SeamlessConfig = {
      paymentToken: 'valid-token-abc123',
    }
    expect(config.paymentToken).toBe('valid-token-abc123')
  })

  it('accepts all optional fields', () => {
    const config: SeamlessConfig = {
      paymentToken: 'valid-token-abc123',
      lang: 'fr',
      closeAfterResponse: true,
      theme: 'dark',
      debug: true,
      onReady: () => {},
      onPaymentSuccess: () => {},
      onPaymentFailed: () => {},
      onPaymentPending: () => {},
      onClose: () => {},
      onError: () => {},
    }
    expect(config.theme).toBe('dark')
    expect(config.debug).toBe(true)
  })
})

describe('PaymentResponse type', () => {
  it('has correct shape', () => {
    const response: PaymentResponse = {
      amount: 1000,
      currency: 'XOF',
      status: 'ACCEPTED',
      paymentMethod: 'OM_CI',
      description: 'Test',
      transactionId: 'TX-123',
    }
    expect(response.status).toBe('ACCEPTED')
  })

  it('supports all statuses', () => {
    const statuses: PaymentStatus[] = ['ACCEPTED', 'REFUSED', 'PENDING', 'INITIATED', 'EXPIRED', 'UNKNOWN']
    expect(statuses).toHaveLength(6)
  })
})
