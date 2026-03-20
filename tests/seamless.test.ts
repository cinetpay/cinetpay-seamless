import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CinetPaySeamless } from '../src/index'

const DIRECT_CONFIG_BASE = {
  apiKey: 'sk_test_abc',
  apiPassword: 'test_password',
  country: 'CI',
  merchantTransactionId: 'TX-1',
  amount: 500,
  currency: 'XOF',
  designation: 'Test payment',
  notifyUrl: 'https://example.com/webhook',
  successUrl: 'https://example.com/success',
  failedUrl: 'https://example.com/failed',
  clientEmail: 'test@test.com',
  clientFirstName: 'Jean',
  clientLastName: 'Dupont',
}

const AUTH_RESPONSE = {
  code: 200,
  status: 'OK',
  access_token: 'jwt-token-abc',
  token_type: 'bearer',
  expires_in: 86400,
}

const PAYMENT_RESPONSE = {
  code: 200,
  status: 'OK',
  payment_token: 'pay-token-xyz',
  payment_url: 'https://secure.cinetpay.net/checkout/pay-token-xyz',
  notify_token: 'notify-abc',
  transaction_id: 'tx-123',
  merchant_transaction_id: 'TX-1',
}

function createMockFetch(authResponse: unknown, paymentResponse: unknown) {
  let callCount = 0
  return vi.fn(async () => {
    callCount++
    const data = callCount === 1 ? authResponse : paymentResponse
    return { json: () => Promise.resolve(data) }
  })
}

describe('CinetPaySeamless', () => {
  beforeEach(() => {
    document.body.textContent = ''
    document.body.style.overflow = ''
  })

  afterEach(() => {
    CinetPaySeamless.close()
    document.querySelectorAll('.cp-seamless-overlay').forEach((el) => el.remove())
    document.getElementById('cp-seamless-styles')?.remove()
    document.body.style.overflow = ''
  })

  describe('Mode Backend', () => {
    it('opens modal with paymentToken', () => {
      CinetPaySeamless.open({ paymentToken: 'abc123-token' })

      const overlay = document.querySelector('.cp-seamless-overlay')
      expect(overlay).not.toBeNull()

      const iframe = document.querySelector('iframe')
      expect(iframe?.src).toContain('abc123-token')
    })

    it('builds correct checkout URL from token', () => {
      CinetPaySeamless.open({ paymentToken: 'my-payment-token-xyz' })

      const iframe = document.querySelector('iframe')
      expect(iframe?.src).toBe('https://secure.cinetpay.net/checkout/my-payment-token-xyz')
    })

    it('passes callbacks to modal', () => {
      const onResponse = vi.fn()
      CinetPaySeamless.open({
        paymentToken: 'valid-test-payment-token-abc123',
        onResponse,
      })

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: { status: 'ACCEPTED', amount: 500, currency: 'XOF', transaction_id: 'TX-1' },
        }),
      )

      expect(onResponse).toHaveBeenCalled()
    })
  })

  describe('Mode Direct (API v1)', () => {
    it('authenticates then initializes payment', async () => {
      const mockFetch = createMockFetch(AUTH_RESPONSE, PAYMENT_RESPONSE)
      globalThis.fetch = mockFetch as unknown as typeof fetch

      await CinetPaySeamless.open(DIRECT_CONFIG_BASE)

      // First call: auth
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const authCall = mockFetch.mock.calls[0]
      expect(authCall[0]).toContain('/v1/oauth/login')
      const authBody = JSON.parse(authCall[1].body)
      expect(authBody.api_key).toBe('sk_test_abc')
      expect(authBody.api_password).toBe('test_password')

      // Second call: payment init with Bearer token
      const payCall = mockFetch.mock.calls[1]
      expect(payCall[0]).toContain('/v1/payment')
      expect(payCall[1].headers.Authorization).toBe('Bearer jwt-token-abc')
    })

    it('sends correct payment body', async () => {
      const mockFetch = createMockFetch(AUTH_RESPONSE, PAYMENT_RESPONSE)
      globalThis.fetch = mockFetch as unknown as typeof fetch

      await CinetPaySeamless.open({
        ...DIRECT_CONFIG_BASE,
        clientPhoneNumber: '+2250707000000',
        paymentMethod: 'OM_CI',
      })

      const payCall = mockFetch.mock.calls[1]
      const body = JSON.parse(payCall[1].body)
      expect(body.currency).toBe('XOF')
      expect(body.merchant_transaction_id).toBe('TX-1')
      expect(body.amount).toBe(500)
      expect(body.designation).toBe('Test payment')
      expect(body.client_email).toBe('test@test.com')
      expect(body.client_first_name).toBe('Jean')
      expect(body.client_last_name).toBe('Dupont')
      expect(body.success_url).toBe('https://example.com/success')
      expect(body.failed_url).toBe('https://example.com/failed')
      expect(body.notify_url).toBe('https://example.com/webhook')
      expect(body.client_phone_number).toBe('+2250707000000')
      expect(body.payment_method).toBe('OM_CI')
    })

    it('opens modal with payment URL', async () => {
      globalThis.fetch = createMockFetch(AUTH_RESPONSE, PAYMENT_RESPONSE) as unknown as typeof fetch

      await CinetPaySeamless.open(DIRECT_CONFIG_BASE)

      const iframe = document.querySelector('iframe')
      expect(iframe?.src).toBe('https://secure.cinetpay.net/checkout/pay-token-xyz')
    })

    it('uses sandbox URL for sk_test_ keys', () => {
      const url = CinetPaySeamless.resolveBaseUrl('sk_test_abc')
      expect(url).toBe('https://api.cinetpay.net')
    })

    it('uses production URL for sk_live_ keys', () => {
      const url = CinetPaySeamless.resolveBaseUrl('sk_live_abc')
      expect(url).toBe('https://api.cinetpay.co')
    })

    it('calls onError when auth fails', async () => {
      globalThis.fetch = vi.fn(async () => ({
        json: () => Promise.resolve({ code: 1005, status: 'INVALID_CREDENTIALS', description: 'Bad credentials' }),
      })) as unknown as typeof fetch

      const onError = vi.fn()
      await CinetPaySeamless.open({ ...DIRECT_CONFIG_BASE, onError })

      expect(onError).toHaveBeenCalledWith({
        code: 'INIT_FAILED',
        message: 'Bad credentials',
      })

      expect(document.querySelector('.cp-seamless-overlay')).toBeNull()
    })

    it('calls onError when payment init fails', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn(async () => {
        callCount++
        if (callCount === 1) return { json: () => Promise.resolve(AUTH_RESPONSE) }
        return { json: () => Promise.resolve({ code: 1004, status: 'INVALID_PARAMS', description: 'Amount too low' }) }
      }) as unknown as typeof fetch

      const onError = vi.fn()
      await CinetPaySeamless.open({ ...DIRECT_CONFIG_BASE, onError })

      expect(onError).toHaveBeenCalledWith({
        code: 'INIT_FAILED',
        message: 'Amount too low',
      })
    })

    it('calls onError when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

      const onError = vi.fn()
      await CinetPaySeamless.open({ ...DIRECT_CONFIG_BASE, onError })

      expect(onError).toHaveBeenCalledWith({
        code: 'INIT_FAILED',
        message: 'Network error',
      })
    })

    it('falls back to payment_token URL when no payment_url', async () => {
      const paymentWithoutUrl = { ...PAYMENT_RESPONSE }
      delete (paymentWithoutUrl as Record<string, unknown>).payment_url

      globalThis.fetch = createMockFetch(AUTH_RESPONSE, paymentWithoutUrl) as unknown as typeof fetch

      await CinetPaySeamless.open(DIRECT_CONFIG_BASE)

      const iframe = document.querySelector('iframe')
      expect(iframe?.src).toBe('https://secure.cinetpay.net/checkout/pay-token-xyz')
    })
  })

  describe('close()', () => {
    it('closes the active modal', () => {
      vi.useFakeTimers()
      CinetPaySeamless.open({ paymentToken: 'valid-test-payment-token-abc123' })
      expect(document.querySelector('.cp-seamless-overlay')).not.toBeNull()

      CinetPaySeamless.close()
      vi.advanceTimersByTime(500)

      expect(document.querySelector('.cp-seamless-overlay')).toBeNull()
      vi.useRealTimers()
    })

    it('does nothing if no modal is open', () => {
      expect(() => CinetPaySeamless.close()).not.toThrow()
    })
  })

  describe('Invalid config', () => {
    it('throws on invalid config', async () => {
      await expect(
        CinetPaySeamless.open({} as any),
      ).rejects.toThrow('Invalid config')
    })

    it('error message mentions apiKey + apiPassword', async () => {
      await expect(
        CinetPaySeamless.open({} as any),
      ).rejects.toThrow('apiPassword')
    })

    it('rejects invalid paymentToken format', async () => {
      await expect(
        CinetPaySeamless.open({ paymentToken: '../../../etc/passwd' }),
      ).rejects.toThrow('Invalid paymentToken format')
    })

    it('rejects paymentToken with special chars', async () => {
      await expect(
        CinetPaySeamless.open({ paymentToken: '<script>alert(1)</script>' }),
      ).rejects.toThrow('Invalid paymentToken format')
    })

    it('rejects too short paymentToken', async () => {
      await expect(
        CinetPaySeamless.open({ paymentToken: 'abc' }),
      ).rejects.toThrow('Invalid paymentToken format')
    })

    it('accepts valid paymentToken', () => {
      expect(() =>
        CinetPaySeamless.open({ paymentToken: '1ef969cf5da467dc98c70242f6c351d52eb3ff889b0f4f9e94078a1a0da6a2a3' }),
      ).not.toThrow()
    })
  })

  describe('Window global', () => {
    it('attaches CinetPaySeamless to window', () => {
      expect((window as any).CinetPaySeamless).toBeDefined()
      expect((window as any).CinetPaySeamless.open).toBeDefined()
      expect((window as any).CinetPaySeamless.close).toBeDefined()
    })
  })

  describe('Multiple opens', () => {
    it('closes previous modal before opening new one', () => {
      vi.useFakeTimers()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-first-1234' })
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-second-5678' })
      vi.advanceTimersByTime(500)

      const iframes = document.querySelectorAll('iframe')
      const lastIframe = iframes[iframes.length - 1]
      expect(lastIframe?.src).toContain('valid-test-token-second-5678')
      vi.useRealTimers()
    })
  })
})
