import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Checkout } from '../src/checkout'
import { Logger } from '../src/logger'
import { EventEmitter } from '../src/emitter'

const noopLogger = new Logger(false)

function mockWindowOpen(blocked = false) {
  const mockPopup = {
    closed: false,
    close: vi.fn(() => { mockPopup.closed = true }),
    focus: vi.fn(),
  }
  vi.stubGlobal('open', blocked ? vi.fn(() => null) : vi.fn(() => mockPopup))
  return mockPopup
}

function createCheckout(overrides: Record<string, unknown> = {}) {
  const emitter = new EventEmitter()
  return {
    checkout: new Checkout({ logger: noopLogger, emitter, ...overrides }),
    emitter,
  }
}

describe('Checkout', () => {
  beforeEach(() => {
    document.body.textContent = ''
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.querySelectorAll('.cp-seamless-overlay').forEach((el) => el.remove())
    document.getElementById('cp-seamless-styles')?.remove()
    document.body.style.overflow = ''
    vi.restoreAllMocks()
  })

  // ── Overlay ──

  describe('Overlay', () => {
    it('creates overlay with waiting screen', () => {
      mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(document.querySelector('.cp-seamless-overlay')).not.toBeNull()
      expect(document.querySelector('.cp-seamless-waiting')).not.toBeNull()
      expect(document.querySelector('.cp-seamless-spinner')).not.toBeNull()
    })

    it('shows waiting title and message', () => {
      mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(document.querySelector('.cp-seamless-waiting-title')?.textContent).toContain('Paiement en cours')
      expect(document.querySelector('.cp-seamless-waiting-msg')?.textContent).toContain('fenêtre CinetPay')
    })

    it('shows cancel button', () => {
      mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/token')
      const btn = document.querySelector('.cp-seamless-cancel-btn')
      expect(btn).not.toBeNull()
      expect(btn?.textContent).toBe('Annuler')
    })

    it('blocks body scroll', () => {
      mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('injects styles once', () => {
      mockWindowOpen()
      const { checkout: c1 } = createCheckout()
      c1.open('https://secure.cinetpay.net/checkout/token1')
      const { checkout: c2 } = createCheckout()
      c2.open('https://secure.cinetpay.net/checkout/token2')
      expect(document.querySelectorAll('#cp-seamless-styles').length).toBe(1)
    })
  })

  // ── Popup ──

  describe('Popup', () => {
    it('opens with correct URL', () => {
      mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/abc123')
      expect(window.open).toHaveBeenCalledWith(
        'https://secure.cinetpay.net/checkout/abc123',
        'CinetPayCheckout',
        expect.stringContaining('width=500'),
      )
    })

    it('emits ready when opened', () => {
      mockWindowOpen()
      const { checkout, emitter } = createCheckout()
      const fn = vi.fn()
      emitter.on('ready', fn)
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('calls onReady callback', () => {
      mockWindowOpen()
      const onReady = vi.fn()
      const { checkout } = createCheckout({ onReady })
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(onReady).toHaveBeenCalledOnce()
    })

    it('emits error when blocked', () => {
      vi.useFakeTimers()
      mockWindowOpen(true)
      const { checkout, emitter } = createCheckout()
      const fn = vi.fn()
      emitter.on('error', fn)
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ code: 'POPUP_BLOCKED' }))
      vi.useRealTimers()
    })

    it('calls onError when blocked', () => {
      vi.useFakeTimers()
      mockWindowOpen(true)
      const onError = vi.fn()
      const { checkout } = createCheckout({ onError })
      checkout.open('https://secure.cinetpay.net/checkout/token')
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'POPUP_BLOCKED' }))
      vi.useRealTimers()
    })

    it('does not listen for payment messages after popup is blocked', () => {
      vi.useFakeTimers()
      mockWindowOpen(true)
      const onPaymentSuccess = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX-BLOCKED' },
      }))

      expect(onPaymentSuccess).not.toHaveBeenCalled()
      vi.advanceTimersByTime(500)
      vi.useRealTimers()
    })

    it('detects popup closure via polling', () => {
      vi.useFakeTimers()
      const mockPopup = mockWindowOpen()
      const onClose = vi.fn()
      const { checkout } = createCheckout({ onClose })
      checkout.open('https://secure.cinetpay.net/checkout/token')
      mockPopup.closed = true
      vi.advanceTimersByTime(1500)
      expect(onClose).toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  // ── Close ──

  describe('close()', () => {
    it('closes popup and removes overlay', () => {
      vi.useFakeTimers()
      const mockPopup = mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/token')
      checkout.close()
      expect(mockPopup.close).toHaveBeenCalled()
      vi.advanceTimersByTime(500)
      expect(document.querySelector('.cp-seamless-overlay')).toBeNull()
      vi.useRealTimers()
    })

    it('restores body scroll', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const { checkout } = createCheckout()
      checkout.open('https://secure.cinetpay.net/checkout/token')
      checkout.close()
      vi.advanceTimersByTime(500)
      expect(document.body.style.overflow).toBe('')
      vi.useRealTimers()
    })

    it('calls onClose with last status', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onClose = vi.fn()
      const { checkout } = createCheckout({ onClose })
      checkout.open('https://secure.cinetpay.net/checkout/token')
      checkout.close()
      vi.advanceTimersByTime(500)
      expect(onClose).toHaveBeenCalledWith({ status: 'UNKNOWN' })
      vi.useRealTimers()
    })

    it('emits close event', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const { checkout, emitter } = createCheckout()
      const fn = vi.fn()
      emitter.on('close', fn)
      checkout.open('https://secure.cinetpay.net/checkout/token')
      checkout.close()
      vi.advanceTimersByTime(500)
      expect(fn).toHaveBeenCalledWith({ status: 'UNKNOWN' })
      vi.useRealTimers()
    })

    it('cancel button triggers close', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onClose = vi.fn()
      const { checkout } = createCheckout({ onClose })
      checkout.open('https://secure.cinetpay.net/checkout/token')
      const btn = document.querySelector('.cp-seamless-cancel-btn') as HTMLElement
      btn.click()
      vi.advanceTimersByTime(500)
      expect(onClose).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('preserves last payment status in close event', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onClose = vi.fn()
      const { checkout } = createCheckout({ onClose })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      // Receive ACCEPTED, then close
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX' },
      }))
      checkout.close()
      vi.advanceTimersByTime(500)
      expect(onClose).toHaveBeenCalledWith({ status: 'ACCEPTED' })
      vi.useRealTimers()
    })
  })

  // ── postMessage ──

  describe('postMessage', () => {
    it('dispatches ACCEPTED to onPaymentSuccess', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX-1', payment_method: 'OM_CI' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACCEPTED', amount: 1000, paymentMethod: 'OM_CI',
      }))
    })

    it('dispatches REFUSED to onPaymentFailed', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentFailed: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-2' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUSED' }))
    })

    it('dispatches PENDING to onPaymentPending', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentPending: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'PENDING', amount: 500, currency: 'XOF', transaction_id: 'TX-3' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }))
    })

    it('dispatches INITIATED to onPaymentPending', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentPending: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'INITIATED', amount: 500, currency: 'XOF', transaction_id: 'TX-4' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'INITIATED' }))
    })

    it('dispatches EXPIRED to onPaymentPending', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentPending: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'EXPIRED', amount: 500, currency: 'XOF', transaction_id: 'TX-5' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'EXPIRED' }))
    })

    it('dispatches unknown status to onPaymentPending', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentPending: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'SOME_NEW_STATUS', amount: 500, currency: 'XOF', transaction_id: 'TX-6' },
      }))

      expect(fn).toHaveBeenCalled()
    })

    it('handles error with code field', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onError: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 'ERROR', message: 'Something went wrong' },
      }))

      expect(fn).toHaveBeenCalledWith({ code: 'ERROR', message: 'Something went wrong' })
    })

    it('handles error with error field', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onError: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { error: 'Network failure' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Network failure' }))
    })

    it('emits error event', () => {
      mockWindowOpen()
      const { checkout, emitter } = createCheckout()
      const fn = vi.fn()
      emitter.on('error', fn)
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 'ERROR', message: 'fail' },
      }))

      expect(fn).toHaveBeenCalledWith({ code: 'ERROR', message: 'fail' })
    })

    it('handles CLOSE action', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onClose = vi.fn()
      const { checkout } = createCheckout({ onClose })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { action: 'CLOSE' },
      }))

      vi.advanceTimersByTime(500)
      expect(onClose).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('handles close type message', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onClose = vi.fn()
      const { checkout } = createCheckout({ onClose })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { type: 'close' },
      }))

      vi.advanceTimersByTime(500)
      expect(onClose).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('parses JSON string messages', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: JSON.stringify({ status: 'ACCEPTED', amount: 2000, currency: 'XAF', transaction_id: 'TX-J' }),
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000 }))
    })

    it('ignores non-JSON strings', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: 'not valid json {{{',
      }))

      expect(fn).not.toHaveBeenCalled()
    })

    it('ignores null/undefined data', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: null,
      }))

      expect(fn).not.toHaveBeenCalled()
    })

    it('maps fields from the current payment status response', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: {
          code: 100,
          status: 'SUCCESS',
          merchant_transaction_id: 'MY-ORDER-ID-08082116',
          transaction_id: '3de579e7ec43451a9463d45d21a4cf48',
          user: {
            name: 'Doe John',
            email: 'john.doe@gmail.com',
            phone_number: '+2250707000000',
          },
        },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACCEPTED',
        rawStatus: 'SUCCESS',
        apiCode: 100,
        transactionId: '3de579e7ec43451a9463d45d21a4cf48',
      }))
    })

    it('uses official API code when status is absent', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentFailed: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: {
          code: 2010,
          transaction_id: 'TX-FAILED-BY-CODE',
        },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'REFUSED',
        apiCode: 2010,
        transactionId: 'TX-FAILED-BY-CODE',
      }))
    })

    it('uses official code 100 as success when no status is present', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 100, transaction_id: 'TX-OK' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACCEPTED',
        apiCode: 100,
        transactionId: 'TX-OK',
      }))
    })

    it('uses official code 2005 as failed when no status is present', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentFailed: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 2005, transaction_id: 'TX-BALANCE' },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'REFUSED',
        apiCode: 2005,
        transactionId: 'TX-BALANCE',
      }))
    })

    it('reads nested details payloads', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: {
          code: 200,
          status: 'OK',
          transaction_id: 'TX-NESTED',
          details: {
            code: 100,
            status: 'SUCCESS',
            message: 'transaction traitée avec succès',
          },
        },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACCEPTED',
        rawStatus: 'SUCCESS',
        apiCode: 100,
        transactionId: 'TX-NESTED',
      }))
    })

    it('prefers official details.status over API envelope status', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentPending: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: {
          code: 200,
          status: 'OK',
          merchant_transaction_id: 'MERCHANT-ID',
          transaction_id: 'TX-DETAILS',
          details: {
            code: 2001,
            status: 'INITIATED',
            message: 'Veuillez cliquer sur le lien pour continuer le paiement',
            must_be_redirected: true,
          },
        },
      }))

      expect(fn).toHaveBeenCalledWith(expect.objectContaining({
        status: 'INITIATED',
        rawStatus: 'INITIATED',
        transactionId: 'TX-DETAILS',
      }))
    })

    it('does not treat API envelope OK as a successful payment', () => {
      mockWindowOpen()
      const success = vi.fn()
      const pending = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: success, onPaymentPending: pending })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 200, status: 'OK', payment_token: 'token', payment_url: 'https://secure.cinetpay.net/payment/token' },
      }))

      expect(success).not.toHaveBeenCalled()
      expect(pending).not.toHaveBeenCalled()
    })

    it('maps official FAILED and INSUFFICIENT_BALANCE statuses to onPaymentFailed', () => {
      mockWindowOpen()
      const failed = vi.fn()
      const { checkout: checkout1 } = createCheckout({ onPaymentFailed: failed })
      checkout1.open('https://secure.cinetpay.net/checkout/token1')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'FAILED', transaction_id: 'TX-FAILED' },
      }))

      const insufficientBalance = vi.fn()
      const { checkout: checkout2 } = createCheckout({ onPaymentFailed: insufficientBalance })
      checkout2.open('https://secure.cinetpay.net/checkout/token2')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'INSUFFICIENT_BALANCE', transaction_id: 'TX-BALANCE' },
      }))

      expect(failed).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUSED', rawStatus: 'FAILED' }))
      expect(insufficientBalance).toHaveBeenCalledWith(expect.objectContaining({
        status: 'REFUSED',
        rawStatus: 'INSUFFICIENT_BALANCE',
      }))
    })

    it('normalizes lowercase and alias statuses', () => {
      mockWindowOpen()
      const success = vi.fn()
      const { checkout: checkout1 } = createCheckout({ onPaymentSuccess: success })
      checkout1.open('https://secure.cinetpay.net/checkout/token1')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'success', transaction_id: 'TX-SUCCESS' },
      }))

      const failed = vi.fn()
      const { checkout: checkout2 } = createCheckout({ onPaymentFailed: failed })
      checkout2.open('https://secure.cinetpay.net/checkout/token2')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'failed', transaction_id: 'TX-FAILED' },
      }))

      expect(success).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED' }))
      expect(failed).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUSED' }))
    })
  })

  // ── Status polling fallback ──

  describe('Status polling fallback', () => {
    it('dispatches success from statusChecker when CinetPay does not postMessage', async () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onPaymentSuccess = vi.fn()
      const onClose = vi.fn()
      const statusChecker = vi.fn().mockResolvedValue({
        code: 100,
        status: 'SUCCESS',
        transaction_id: 'TX-STATUS-SUCCESS',
      })
      const { checkout } = createCheckout({ onPaymentSuccess, onClose, statusChecker })

      checkout.open('https://secure.cinetpay.net/checkout/token')
      await vi.runOnlyPendingTimersAsync()

      expect(statusChecker).toHaveBeenCalled()
      expect(onPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACCEPTED',
        rawStatus: 'SUCCESS',
        apiCode: 100,
        transactionId: 'TX-STATUS-SUCCESS',
      }))

      vi.advanceTimersByTime(500)
      expect(onClose).toHaveBeenCalledWith({ status: 'ACCEPTED' })
      vi.useRealTimers()
    })

    it('checks status one last time when popup closes', async () => {
      vi.useFakeTimers()
      const mockPopup = mockWindowOpen()
      const onPaymentPending = vi.fn()
      const onPaymentSuccess = vi.fn()
      const statusChecker = vi.fn()
        .mockResolvedValueOnce({ code: 2001, status: 'INITIATED', transaction_id: 'TX-CLOSE' })
        .mockResolvedValueOnce({ code: 100, status: 'SUCCESS', transaction_id: 'TX-CLOSE' })
      const { checkout } = createCheckout({ onPaymentPending, onPaymentSuccess, statusChecker })

      checkout.open('https://secure.cinetpay.net/checkout/token')
      await vi.runOnlyPendingTimersAsync()
      expect(onPaymentPending).toHaveBeenCalledWith(expect.objectContaining({ status: 'INITIATED' }))

      mockPopup.closed = true
      await vi.advanceTimersByTimeAsync(1000)

      expect(statusChecker).toHaveBeenCalledTimes(2)
      expect(onPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACCEPTED' }))
      vi.useRealTimers()
    })

    it('does not duplicate final callbacks between statusChecker and postMessage', async () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const onPaymentSuccess = vi.fn()
      const statusChecker = vi.fn().mockResolvedValue({
        code: 100,
        status: 'SUCCESS',
        transaction_id: 'TX-DEDUP',
      })
      const { checkout } = createCheckout({ onPaymentSuccess, statusChecker })

      checkout.open('https://secure.cinetpay.net/checkout/token')
      await vi.runOnlyPendingTimersAsync()

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 100, status: 'SUCCESS', transaction_id: 'TX-DEDUP' },
      }))

      expect(onPaymentSuccess).toHaveBeenCalledOnce()
      vi.useRealTimers()
    })
  })

  // ── Origin security ──

  describe('Origin security', () => {
    it('ignores unknown origins', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { status: 'ACCEPTED', amount: 999 },
      }))

      expect(fn).not.toHaveBeenCalled()
    })

    it('ignores lookalike domains', () => {
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')

      for (const origin of [
        'https://cinetpay.evil.com',
        'https://fakecinetpay.net',
        'https://secure.cinetpay.net.evil.com',
      ]) {
        window.dispatchEvent(new MessageEvent('message', {
          origin,
          data: { status: 'ACCEPTED', amount: 999, transaction_id: 'FAKE' },
        }))
      }

      expect(fn).not.toHaveBeenCalled()
    })

    it('accepts all valid CinetPay origins', () => {
      const validOrigins = [
        'https://secure.cinetpay.net',
        'https://secure.cinetpay.com',
        'https://checkout.cinetpay.net',
        'https://checkout.cinetpay.com',
        'https://api.cinetpay.net',
        'https://api.cinetpay.co',
      ]

      for (const origin of validOrigins) {
        mockWindowOpen()
        const fn = vi.fn()
        const { checkout } = createCheckout({ onPaymentSuccess: fn })
        checkout.open('https://secure.cinetpay.net/checkout/token')

        window.dispatchEvent(new MessageEvent('message', {
          origin,
          data: { status: 'ACCEPTED', amount: 100, currency: 'XOF', transaction_id: 'TX' },
        }))

        expect(fn).toHaveBeenCalled()
      }
    })

    it('removes listener after close', () => {
      vi.useFakeTimers()
      mockWindowOpen()
      const fn = vi.fn()
      const { checkout } = createCheckout({ onPaymentSuccess: fn })
      checkout.open('https://secure.cinetpay.net/checkout/token')
      checkout.close()
      vi.advanceTimersByTime(500)

      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 100, transaction_id: 'TX' },
      }))

      expect(fn).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })
})
