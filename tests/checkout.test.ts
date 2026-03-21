import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Checkout } from '../src/checkout'
import { Logger } from '../src/logger'
import { EventEmitter } from '../src/emitter'

const noopLogger = new Logger(false)

// Mock window.open
function mockWindowOpen(blocked = false) {
  const mockPopup = {
    closed: false,
    close: vi.fn(() => { mockPopup.closed = true }),
    focus: vi.fn(),
  }

  vi.stubGlobal('open', blocked ? vi.fn(() => null) : vi.fn(() => mockPopup))

  return mockPopup
}

describe('Checkout', () => {
  let emitter: EventEmitter

  beforeEach(() => {
    document.body.textContent = ''
    document.body.style.overflow = ''
    emitter = new EventEmitter()
  })

  afterEach(() => {
    document.querySelectorAll('.cp-seamless-overlay').forEach((el) => el.remove())
    document.getElementById('cp-seamless-styles')?.remove()
    document.body.style.overflow = ''
    vi.restoreAllMocks()
  })

  it('creates overlay with waiting screen', () => {
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(document.querySelector('.cp-seamless-overlay')).not.toBeNull()
    expect(document.querySelector('.cp-seamless-waiting')).not.toBeNull()
    expect(document.querySelector('.cp-seamless-spinner')).not.toBeNull()
  })

  it('shows waiting title and message', () => {
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    const title = document.querySelector('.cp-seamless-waiting-title')
    expect(title?.textContent).toContain('Paiement en cours')

    const msg = document.querySelector('.cp-seamless-waiting-msg')
    expect(msg?.textContent).toContain('fenêtre CinetPay')
  })

  it('shows cancel button', () => {
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    const btn = document.querySelector('.cp-seamless-cancel-btn')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toBe('Annuler')
  })

  it('calls window.open with correct URL and dimensions', () => {
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/abc123')

    expect(window.open).toHaveBeenCalledWith(
      'https://secure.cinetpay.net/checkout/abc123',
      'CinetPayCheckout',
      expect.stringContaining('width=500'),
    )
  })

  it('blocks body scroll when open', () => {
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('calls onReady when popup opens', () => {
    mockWindowOpen()
    const onReady = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onReady })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(onReady).toHaveBeenCalledOnce()
  })

  it('emits ready event when popup opens', () => {
    mockWindowOpen()
    const handler = vi.fn()
    emitter.on('ready', handler)

    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls onError when popup is blocked', () => {
    vi.useFakeTimers()
    mockWindowOpen(true) // blocked
    const onError = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onError })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'POPUP_BLOCKED' }),
    )
    vi.useRealTimers()
  })

  it('emits error event when popup is blocked', () => {
    vi.useFakeTimers()
    mockWindowOpen(true)
    const handler = vi.fn()
    emitter.on('error', handler)

    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'POPUP_BLOCKED' }),
    )
    vi.useRealTimers()
  })

  it('closes popup on cancel button click', () => {
    vi.useFakeTimers()
    const mockPopup = mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    const cancelBtn = document.querySelector('.cp-seamless-cancel-btn') as HTMLElement
    cancelBtn.click()

    expect(mockPopup.close).toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(document.querySelector('.cp-seamless-overlay')).toBeNull()
    vi.useRealTimers()
  })

  it('calls onClose after close', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter, onClose })
    checkout.open('https://secure.cinetpay.net/checkout/token')
    checkout.close()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalledWith({ status: 'UNKNOWN' })
    vi.useRealTimers()
  })

  it('restores body scroll after close', () => {
    vi.useFakeTimers()
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')
    checkout.close()

    vi.advanceTimersByTime(500)
    expect(document.body.style.overflow).toBe('')
    vi.useRealTimers()
  })

  it('handles postMessage ACCEPTED from popup', () => {
    mockWindowOpen()
    const onPaymentSuccess = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onPaymentSuccess })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX-1' },
      }),
    )

    expect(onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACCEPTED', amount: 1000 }),
    )
  })

  it('handles postMessage REFUSED from popup', () => {
    mockWindowOpen()
    const onPaymentFailed = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onPaymentFailed })
    checkout.open('https://secure.cinetpay.net/checkout/token')

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

  it('handles postMessage PENDING from popup', () => {
    mockWindowOpen()
    const onPaymentPending = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onPaymentPending })
    checkout.open('https://secure.cinetpay.net/checkout/token')

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

  it('ignores messages from non-CinetPay origins', () => {
    mockWindowOpen()
    const onPaymentSuccess = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onPaymentSuccess })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { status: 'ACCEPTED', amount: 999 },
      }),
    )

    expect(onPaymentSuccess).not.toHaveBeenCalled()
  })

  it('detects popup closure via polling', () => {
    vi.useFakeTimers()
    const mockPopup = mockWindowOpen()
    const onClose = vi.fn()
    const checkout = new Checkout({ logger: noopLogger, emitter, onClose })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    // Simulate popup being closed
    mockPopup.closed = true

    // Poll interval (500ms) + internal setTimeout(500ms) + close animation (300ms)
    vi.advanceTimersByTime(1500)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('injects styles', () => {
    mockWindowOpen()
    const checkout = new Checkout({ logger: noopLogger, emitter })
    checkout.open('https://secure.cinetpay.net/checkout/token')

    expect(document.getElementById('cp-seamless-styles')).not.toBeNull()
  })

  it('does not duplicate styles on multiple opens', () => {
    mockWindowOpen()
    const c1 = new Checkout({ logger: noopLogger, emitter })
    c1.open('https://secure.cinetpay.net/checkout/token1')
    const c2 = new Checkout({ logger: noopLogger, emitter })
    c2.open('https://secure.cinetpay.net/checkout/token2')

    expect(document.querySelectorAll('#cp-seamless-styles').length).toBe(1)
  })
})
