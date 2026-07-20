import { describe, it, expect } from 'vitest'
import type { SeamlessConfig, PaymentResponse, PaymentError, PaymentStatus } from '../src/types'

describe('SeamlessConfig', () => {
  it('requires paymentToken', () => {
    const config: SeamlessConfig = { paymentToken: 'valid-token-abc123' }
    expect(config.paymentToken).toBe('valid-token-abc123')
  })

  it('accepts all optional callbacks', () => {
    const config: SeamlessConfig = {
      paymentToken: 'valid-token-abc123',
      statusUrl: '/api/cinetpay/status?transactionId=TX',
      checkStatus: async () => ({ status: 'SUCCESS' }),
      statusPollInterval: 2000,
      lang: 'fr',
      debug: true,
      onReady: () => {},
      onPaymentSuccess: () => {},
      onPaymentFailed: () => {},
      onPaymentPending: () => {},
      onClose: () => {},
      onError: () => {},
    }
    expect(config.debug).toBe(true)
    expect(config.lang).toBe('fr')
    expect(config.statusUrl).toContain('/api/cinetpay/status')
    expect(config.statusPollInterval).toBe(2000)
  })
})

describe('PaymentResponse', () => {
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
    expect(response.amount).toBe(1000)
  })

  it('supports optional fields', () => {
    const response: PaymentResponse = {
      amount: 500,
      currency: 'XAF',
      status: 'REFUSED',
      paymentMethod: 'MTN_CM',
      description: 'Test',
      transactionId: 'TX-456',
      metadata: 'order-123',
      operatorId: 'op-789',
      paymentDate: '2026-03-21',
    }
    expect(response.metadata).toBe('order-123')
    expect(response.operatorId).toBe('op-789')
  })
})

describe('PaymentStatus', () => {
  it('supports all statuses', () => {
    const statuses: PaymentStatus[] = [
      'ACCEPTED',
      'REFUSED',
      'PENDING',
      'INITIATED',
      'EXPIRED',
      'UNKNOWN',
    ]
    expect(statuses).toHaveLength(6)
  })
})

describe('PaymentError', () => {
  it('has code and message', () => {
    const error: PaymentError = { code: 'POPUP_BLOCKED', message: 'Popup blocked' }
    expect(error.code).toBe('POPUP_BLOCKED')
    expect(error.message).toBe('Popup blocked')
  })
})
