import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CinetPaySeamless } from '../src/index'

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
      const onClose = vi.fn()
      const onError = vi.fn()

      CinetPaySeamless.open({
        paymentToken: 'token',
        onResponse,
        onClose,
        onError,
      })

      // Simulate payment response
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: {
            status: 'ACCEPTED',
            amount: 500,
            currency: 'XOF',
            transaction_id: 'TX-1',
          },
        }),
      )

      expect(onResponse).toHaveBeenCalled()
    })
  })

  describe('Mode Direct', () => {
    it('calls checkout API and opens modal on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            code: '201',
            data: { payment_url: 'https://secure.cinetpay.net/checkout/direct-token' },
          }),
      })
      globalThis.fetch = mockFetch as unknown as typeof fetch

      await CinetPaySeamless.open({
        apiKey: 'sk_test_abc',
        siteId: 123456,
        transactionId: 'TX-DIRECT',
        amount: 1000,
        currency: 'XOF',
        description: 'Test direct',
        notifyUrl: 'https://example.com/webhook',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/payment'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const iframe = document.querySelector('iframe')
      expect(iframe?.src).toBe('https://secure.cinetpay.net/checkout/direct-token')
    })

    it('sends correct body to checkout API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            code: '201',
            data: { payment_url: 'https://secure.cinetpay.net/checkout/x' },
          }),
      })
      globalThis.fetch = mockFetch as unknown as typeof fetch

      await CinetPaySeamless.open({
        apiKey: 'sk_test_key',
        siteId: 999,
        transactionId: 'TX-BODY',
        amount: 2000,
        currency: 'XAF',
        description: 'Body test',
        notifyUrl: 'https://example.com/notify',
        channels: 'MOBILE_MONEY',
        customerName: 'Jean',
        customerEmail: 'jean@test.com',
        customerPhoneNumber: '+2250707000000',
      })

      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body)

      expect(body.apikey).toBe('sk_test_key')
      expect(body.site_id).toBe(999)
      expect(body.transaction_id).toBe('TX-BODY')
      expect(body.amount).toBe(2000)
      expect(body.currency).toBe('XAF')
      expect(body.channels).toBe('MOBILE_MONEY')
      expect(body.customer_name).toBe('Jean')
      expect(body.customer_email).toBe('jean@test.com')
      expect(body.customer_phone_number).toBe('+2250707000000')
    })

    it('calls onError when checkout API fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            code: '401',
            message: 'Invalid API key',
          }),
      })
      globalThis.fetch = mockFetch as unknown as typeof fetch

      const onError = vi.fn()

      await CinetPaySeamless.open({
        apiKey: 'sk_test_bad',
        siteId: 123,
        transactionId: 'TX-FAIL',
        amount: 500,
        currency: 'XOF',
        description: 'Fail test',
        notifyUrl: 'https://example.com/webhook',
        onError,
      })

      expect(onError).toHaveBeenCalledWith({
        code: 'INIT_FAILED',
        message: 'Invalid API key',
      })

      // Modal should NOT be opened
      const overlay = document.querySelector('.cp-seamless-overlay')
      expect(overlay).toBeNull()
    })

    it('calls onError when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

      const onError = vi.fn()

      await CinetPaySeamless.open({
        apiKey: 'sk_test_x',
        siteId: 1,
        transactionId: 'TX-NET',
        amount: 500,
        currency: 'XOF',
        description: 'Net test',
        notifyUrl: 'https://example.com/webhook',
        onError,
      })

      expect(onError).toHaveBeenCalledWith({
        code: 'INIT_FAILED',
        message: 'Network error',
      })
    })

    it('defaults channels to ALL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            code: '201',
            data: { payment_url: 'https://secure.cinetpay.net/checkout/x' },
          }),
      })
      globalThis.fetch = mockFetch as unknown as typeof fetch

      await CinetPaySeamless.open({
        apiKey: 'sk_test_x',
        siteId: 1,
        transactionId: 'TX-CH',
        amount: 500,
        currency: 'XOF',
        description: 'Channel test',
        notifyUrl: 'https://example.com/webhook',
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.channels).toBe('ALL')
    })
  })

  describe('close()', () => {
    it('closes the active modal', () => {
      vi.useFakeTimers()
      CinetPaySeamless.open({ paymentToken: 'token' })
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
    it('throws on invalid config (no paymentToken nor apiKey)', async () => {
      await expect(
        CinetPaySeamless.open({} as any),
      ).rejects.toThrow('Invalid config')
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
      CinetPaySeamless.open({ paymentToken: 'token-1' })
      expect(document.querySelector('.cp-seamless-overlay')).not.toBeNull()

      // Second open triggers close on the first (with animation delay)
      CinetPaySeamless.open({ paymentToken: 'token-2' })
      vi.advanceTimersByTime(500)

      // After animation, only the second modal's iframe remains
      const iframes = document.querySelectorAll('iframe')
      const lastIframe = iframes[iframes.length - 1]
      expect(lastIframe?.src).toContain('token-2')
      vi.useRealTimers()
    })
  })
})
