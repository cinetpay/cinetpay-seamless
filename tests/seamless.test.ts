import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CinetPaySeamless } from '../src/index'

function mockWindowOpen() {
  const mockPopup = { closed: false, close: vi.fn(() => { mockPopup.closed = true }), focus: vi.fn() }
  vi.stubGlobal('open', vi.fn(() => mockPopup))
  return mockPopup
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
    vi.restoreAllMocks()
  })

  describe('open()', () => {
    it('opens popup and shows overlay', () => {
      mockWindowOpen()
      CinetPaySeamless.open({ paymentToken: 'abc123-valid-token-xyz' })

      expect(document.querySelector('.cp-seamless-overlay')).not.toBeNull()
      expect(window.open).toHaveBeenCalled()
    })

    it('opens popup with correct checkout URL', () => {
      mockWindowOpen()
      CinetPaySeamless.open({ paymentToken: 'my-payment-token-xyz789' })

      expect(window.open).toHaveBeenCalledWith(
        'https://secure.cinetpay.net/checkout/my-payment-token-xyz789',
        'CinetPayCheckout',
        expect.any(String),
      )
    })

    it('calls onPaymentSuccess on ACCEPTED postMessage', () => {
      mockWindowOpen()
      const onPaymentSuccess = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-callback', onPaymentSuccess })

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: { status: 'ACCEPTED', amount: 500, currency: 'XOF', transaction_id: 'TX-1' },
        }),
      )

      expect(onPaymentSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED', amount: 500 }),
      )
    })

    it('calls onPaymentFailed on REFUSED', () => {
      mockWindowOpen()
      const onPaymentFailed = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-failed-cb', onPaymentFailed })

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-2' },
        }),
      )

      expect(onPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REFUSED' }),
      )
    })

    it('calls onPaymentPending on PENDING', () => {
      mockWindowOpen()
      const onPaymentPending = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-pending-cb', onPaymentPending })

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: { status: 'PENDING', amount: 500, currency: 'XOF', transaction_id: 'TX-3' },
        }),
      )

      expect(onPaymentPending).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      )
    })
  })

  describe('Validation', () => {
    it('rejects invalid paymentToken format', () => {
      expect(() =>
        CinetPaySeamless.open({ paymentToken: '../../../etc/passwd' }),
      ).toThrow('Invalid paymentToken format')
    })

    it('rejects paymentToken with special chars', () => {
      expect(() =>
        CinetPaySeamless.open({ paymentToken: '<script>alert(1)</script>' }),
      ).toThrow('Invalid paymentToken format')
    })

    it('rejects too short paymentToken', () => {
      expect(() =>
        CinetPaySeamless.open({ paymentToken: 'abc' }),
      ).toThrow('Invalid paymentToken format')
    })

    it('accepts valid paymentToken', () => {
      mockWindowOpen()
      expect(() =>
        CinetPaySeamless.open({ paymentToken: '1ef969cf5da467dc98c70242f6c351d52eb3ff889b0f4f9e94078a1a0da6a2a3' }),
      ).not.toThrow()
    })
  })

  describe('close()', () => {
    it('closes overlay and popup', () => {
      vi.useFakeTimers()
      const mockPopup = mockWindowOpen()
      CinetPaySeamless.open({ paymentToken: 'valid-test-close-token1' })

      CinetPaySeamless.close()
      expect(mockPopup.close).toHaveBeenCalled()

      vi.advanceTimersByTime(500)
      expect(document.querySelector('.cp-seamless-overlay')).toBeNull()
      vi.useRealTimers()
    })

    it('does nothing if no checkout is open', () => {
      expect(() => CinetPaySeamless.close()).not.toThrow()
    })
  })

  describe('Event listeners (on/off/once)', () => {
    it('on/off/once are exposed', () => {
      expect(typeof CinetPaySeamless.on).toBe('function')
      expect(typeof CinetPaySeamless.off).toBe('function')
      expect(typeof CinetPaySeamless.once).toBe('function')
    })

    it('on() receives payment.success events', () => {
      mockWindowOpen()
      const handler = vi.fn()
      CinetPaySeamless.on('payment.success', handler)

      CinetPaySeamless.open({ paymentToken: 'valid-test-event-success1' })

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX-EV' },
        }),
      )

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED', amount: 1000 }),
      )
    })

    it('on() returns unsubscribe function', () => {
      mockWindowOpen()
      const handler = vi.fn()
      const unsub = CinetPaySeamless.on('payment.success', handler)
      unsub()

      CinetPaySeamless.open({ paymentToken: 'valid-test-event-unsub12' })

      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://secure.cinetpay.net',
          data: { status: 'ACCEPTED', amount: 1, currency: 'XOF', transaction_id: 'TX' },
        }),
      )

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Window global', () => {
    it('attaches CinetPaySeamless to window', () => {
      expect((window as any).CinetPaySeamless).toBeDefined()
      expect((window as any).CinetPaySeamless.open).toBeDefined()
      expect((window as any).CinetPaySeamless.close).toBeDefined()
      expect((window as any).CinetPaySeamless.on).toBeDefined()
    })
  })

  describe('Debug mode', () => {
    it('logs when debug is true', () => {
      mockWindowOpen()
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-debug-test', debug: true })

      const calls = spy.mock.calls.map(c => c[0])
      expect(calls.some((c: string) => c.includes('[CinetPay Seamless]'))).toBe(true)
      spy.mockRestore()
    })

    it('does not log when debug is false', () => {
      mockWindowOpen()
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-no-debug-1', debug: false })

      const calls = spy.mock.calls.map(c => c[0])
      expect(calls.some((c: string) => typeof c === 'string' && c.includes('[CinetPay Seamless]'))).toBe(false)
      spy.mockRestore()
    })
  })
})
