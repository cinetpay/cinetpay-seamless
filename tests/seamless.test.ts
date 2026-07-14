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

  // ── open() ──

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
  })

  // ── Callbacks ──

  describe('Callbacks', () => {
    it('calls onPaymentSuccess on ACCEPTED', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-success1', onPaymentSuccess: fn })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 500, currency: 'XOF', transaction_id: 'TX-1' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED', amount: 500 }))
    })

    it('calls onPaymentFailed on REFUSED', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-failed11', onPaymentFailed: fn })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-2' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUSED' }))
    })

    it('supports common onPaymentSuccess casing mistakes in vanilla JS', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({
        paymentToken: 'valid-test-token-alias-ok',
        onPaymentsuccess: fn,
      })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'SUCCESS', transaction_id: 'TX-ALIAS-OK' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED' }))
    })

    it('supports common onPaymentFailed casing mistakes in vanilla JS', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({
        paymentToken: 'valid-test-token-alias-ko',
        onpaymentfailed: fn,
      })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'FAILED', transaction_id: 'TX-ALIAS-KO' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUSED' }))
    })

    it('calls onPaymentPending on PENDING', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-pending1', onPaymentPending: fn })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'PENDING', amount: 500, currency: 'XOF', transaction_id: 'TX-3' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }))
    })

    it('calls onError when popup is blocked', () => {
      vi.useFakeTimers()
      vi.stubGlobal('open', vi.fn(() => null))
      const fn = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-blocked1', onError: fn })
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ code: 'POPUP_BLOCKED' }))
      vi.useRealTimers()
    })

    it('calls onClose after close', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-close-11', onClose: fn })
      CinetPaySeamless.close()
      vi.advanceTimersByTime(500)
      expect(fn).toHaveBeenCalledWith({ status: 'UNKNOWN' })
      vi.useRealTimers()
    })

    it('calls onReady when popup opens', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-ready-11', onReady: fn })
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  // ── Validation ──

  describe('Validation', () => {
    it('rejects path traversal', () => {
      expect(() => CinetPaySeamless.open({ paymentToken: '../../../etc/passwd' }))
        .toThrow('Invalid paymentToken format')
    })

    it('rejects XSS', () => {
      expect(() => CinetPaySeamless.open({ paymentToken: '<script>alert(1)</script>' }))
        .toThrow('Invalid paymentToken format')
    })

    it('rejects too short', () => {
      expect(() => CinetPaySeamless.open({ paymentToken: 'abc' }))
        .toThrow('Invalid paymentToken format')
    })

    it('accepts valid token', () => {
      mockWindowOpen()
      expect(() => CinetPaySeamless.open({
        paymentToken: '1ef969cf5da467dc98c70242f6c351d52eb3ff889b0f4f9e94078a1a0da6a2a3',
      })).not.toThrow()
    })
  })

  // ── close() ──

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

    it('does nothing if not open', () => {
      expect(() => CinetPaySeamless.close()).not.toThrow()
    })
  })

  // ── Event listeners on/off/once ──

  describe('Event listeners', () => {
    it('on() receives events', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.on('payment.success', fn)
      CinetPaySeamless.open({ paymentToken: 'valid-test-event-success1' })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED' }))
    })

    it('on() returns unsubscribe function', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const unsub = CinetPaySeamless.on('payment.success', fn)
      unsub()

      CinetPaySeamless.open({ paymentToken: 'valid-test-event-unsub12' })
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1, currency: 'XOF', transaction_id: 'TX' },
      }))

      expect(fn).not.toHaveBeenCalled()
    })

    it('off() removes handler', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.on('payment.failed', fn)
      CinetPaySeamless.off('payment.failed', fn)

      CinetPaySeamless.open({ paymentToken: 'valid-test-event-off-123' })
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 1, currency: 'XOF', transaction_id: 'TX' },
      }))

      expect(fn).not.toHaveBeenCalled()
    })

    it('once() fires only once', () => {
      mockWindowOpen()
      const fn = vi.fn()
      CinetPaySeamless.once('payment.success', fn)

      CinetPaySeamless.open({ paymentToken: 'valid-test-event-once-12' })

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1, currency: 'XOF', transaction_id: 'TX1' },
      }))
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 2, currency: 'XOF', transaction_id: 'TX2' },
      }))

      expect(fn).toHaveBeenCalledOnce()
    })
  })

  // ── Window global ──

  describe('Window global', () => {
    it('attaches to window', () => {
      expect((window as any).CinetPaySeamless).toBeDefined()
      expect((window as any).CinetPaySeamless.open).toBeDefined()
      expect((window as any).CinetPaySeamless.close).toBeDefined()
      expect((window as any).CinetPaySeamless.on).toBeDefined()
      expect((window as any).CinetPaySeamless.off).toBeDefined()
      expect((window as any).CinetPaySeamless.once).toBeDefined()
    })
  })

  // ── Debug ──

  describe('Debug', () => {
    it('logs when enabled', () => {
      mockWindowOpen()
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-debug-01', debug: true })
      expect(spy.mock.calls.some(c => (c[0] as string).includes('[CinetPay Seamless]'))).toBe(true)
      spy.mockRestore()
    })

    it('silent when disabled', () => {
      mockWindowOpen()
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      CinetPaySeamless.open({ paymentToken: 'valid-test-token-no-dbg-1', debug: false })
      expect(spy.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('[CinetPay Seamless]'))).toBe(false)
      spy.mockRestore()
    })
  })
})
