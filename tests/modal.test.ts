import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Modal } from '../src/modal'
import { Logger } from '../src/logger'

const noopLogger = new Logger(false)

describe('Modal', () => {
  beforeEach(() => {
    document.body.textContent = ''
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.querySelectorAll('.cp-seamless-overlay').forEach((el) => el.remove())
    document.getElementById('cp-seamless-styles')?.remove()
    document.body.style.overflow = ''
  })

  it('opens and adds overlay to DOM', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://secure.cinetpay.net/checkout/test-token')

    const overlay = document.querySelector('.cp-seamless-overlay')
    expect(overlay).not.toBeNull()
  })

  it('injects styles into head', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://secure.cinetpay.net/checkout/test-token')

    const style = document.getElementById('cp-seamless-styles')
    expect(style).not.toBeNull()
    expect(style?.tagName).toBe('STYLE')
  })

  it('does not duplicate styles on multiple opens', () => {
    const modal1 = new Modal({ logger: noopLogger })
    modal1.open('https://example.com/pay1')

    const modal2 = new Modal({ logger: noopLogger })
    modal2.open('https://example.com/pay2')

    const styles = document.querySelectorAll('#cp-seamless-styles')
    expect(styles.length).toBe(1)
  })

  it('creates an iframe with the payment URL', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://secure.cinetpay.net/checkout/abc123')

    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.src).toBe('https://secure.cinetpay.net/checkout/abc123')
  })

  it('sets sandbox attribute on iframe', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://secure.cinetpay.net/checkout/abc123')

    const iframe = document.querySelector('iframe')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-same-origin')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-forms')
  })

  it('blocks body scroll when open', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body scroll after close', () => {
    vi.useFakeTimers()
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)
    expect(document.body.style.overflow).toBe('')
    vi.useRealTimers()
  })

  it('removes overlay from DOM after close', () => {
    vi.useFakeTimers()
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)
    const overlay = document.querySelector('.cp-seamless-overlay')
    expect(overlay).toBeNull()
    vi.useRealTimers()
  })

  it('calls onClose callback when closed', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const modal = new Modal({ onClose, logger: noopLogger })
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalledWith({ status: 'UNKNOWN' })
    vi.useRealTimers()
  })

  it('closes when clicking overlay background', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const modal = new Modal({ onClose, logger: noopLogger })
    modal.open('https://example.com/pay')

    const overlay = document.querySelector('.cp-seamless-overlay') as HTMLElement
    overlay.click()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not close when clicking modal content', () => {
    const onClose = vi.fn()
    const modal = new Modal({ onClose, logger: noopLogger })
    modal.open('https://example.com/pay')

    const modalEl = document.querySelector('.cp-seamless-modal') as HTMLElement
    modalEl.click()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when clicking close button', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const modal = new Modal({ onClose, logger: noopLogger })
    modal.open('https://example.com/pay')

    const closeBtn = document.querySelector('.cp-seamless-close') as HTMLElement
    closeBtn.click()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('applies dark theme class', () => {
    const modal = new Modal({ theme: 'dark', logger: noopLogger })
    modal.open('https://example.com/pay')

    const modalEl = document.querySelector('.cp-seamless-modal')
    expect(modalEl?.classList.contains('cp-dark')).toBe(true)
  })

  it('applies light theme by default', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    const modalEl = document.querySelector('.cp-seamless-modal')
    expect(modalEl?.classList.contains('cp-dark')).toBe(false)
  })

  it('shows loading spinner initially', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    expect(document.querySelector('.cp-seamless-loading')).not.toBeNull()
    expect(document.querySelector('.cp-seamless-spinner')).not.toBeNull()
  })

  it('shows CinetPay logo in header', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    const logo = document.querySelector('.cp-seamless-logo')
    expect(logo).not.toBeNull()
    expect(logo?.querySelector('svg')).not.toBeNull()
  })

  it('calls onReady when iframe loads', () => {
    const onReady = vi.fn()
    const modal = new Modal({ onReady, logger: noopLogger })
    modal.open('https://example.com/pay')

    // Simulate iframe load event
    const iframe = document.querySelector('iframe') as HTMLIFrameElement
    iframe.dispatchEvent(new Event('load'))

    expect(onReady).toHaveBeenCalledOnce()
  })

  it('dispatches PENDING status to onPaymentPending', () => {
    const onPaymentPending = vi.fn()
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentPending, onPaymentSuccess, closeAfterResponse: false, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'PENDING', amount: 1000, currency: 'XOF', transaction_id: 'TX-P' },
      }),
    )

    expect(onPaymentPending).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
    )
    expect(onPaymentSuccess).not.toHaveBeenCalled()
  })

  it('dispatches INITIATED status to onPaymentPending', () => {
    const onPaymentPending = vi.fn()
    const modal = new Modal({ onPaymentPending, closeAfterResponse: false, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'INITIATED', amount: 500, currency: 'XOF', transaction_id: 'TX-I' },
      }),
    )

    expect(onPaymentPending).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'INITIATED' }),
    )
  })

  it('does not show result screen for PENDING status', () => {
    const modal = new Modal({ closeAfterResponse: true, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'PENDING', amount: 1000, currency: 'XOF', transaction_id: 'TX-NR' },
      }),
    )

    // Result screen should NOT appear for non-final statuses
    expect(document.querySelector('.cp-seamless-result')).toBeNull()
  })

  it('does not call onPaymentSuccess for REFUSED', () => {
    const onPaymentSuccess = vi.fn()
    const onPaymentFailed = vi.fn()
    const modal = new Modal({ onPaymentSuccess, onPaymentFailed, closeAfterResponse: false, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-R' },
      }),
    )

    expect(onPaymentFailed).toHaveBeenCalled()
    expect(onPaymentSuccess).not.toHaveBeenCalled()
  })

  it('shows footer with security text', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    const footer = document.querySelector('.cp-seamless-footer')
    expect(footer).not.toBeNull()
    expect(footer?.textContent).toContain('CinetPay')
  })

  it('handles postMessage ACCEPTED response', () => {
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentSuccess, closeAfterResponse: false, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: {
          status: 'ACCEPTED',
          amount: 1000,
          currency: 'XOF',
          payment_method: 'OM',
          description: 'Test',
          transaction_id: 'TX-123',
        },
      }),
    )

    expect(onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACCEPTED',
        amount: 1000,
        currency: 'XOF',
        paymentMethod: 'OM',
        transactionId: 'TX-123',
      }),
    )
  })

  it('handles REFUSED status via onPaymentFailed', () => {
    const onPaymentFailed = vi.fn()
    const modal = new Modal({ onPaymentFailed, closeAfterResponse: false, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-456' },
      }),
    )

    expect(onPaymentFailed).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REFUSED' }),
    )
  })

  it('shows success result screen on closeAfterResponse', () => {
    const modal = new Modal({ closeAfterResponse: true, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 1000, currency: 'XOF', transaction_id: 'TX-789' },
      }),
    )

    expect(document.querySelector('.cp-seamless-result')).not.toBeNull()
    expect(document.querySelector('.cp-success')).not.toBeNull()
  })

  it('shows failure result screen', () => {
    const modal = new Modal({ closeAfterResponse: true, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-fail' },
      }),
    )

    expect(document.querySelector('.cp-failure')).not.toBeNull()
  })

  it('calls onError on error messages', () => {
    const onError = vi.fn()
    const modal = new Modal({ onError, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { code: 'ERROR', message: 'Something went wrong' },
      }),
    )

    expect(onError).toHaveBeenCalledWith({
      code: 'ERROR',
      message: 'Something went wrong',
    })
  })

  it('ignores messages from non-cinetpay origins', () => {
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentSuccess, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { status: 'ACCEPTED', amount: 999 },
      }),
    )

    expect(onPaymentSuccess).not.toHaveBeenCalled()
  })

  it('ignores messages from lookalike cinetpay domains', () => {
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentSuccess, logger: noopLogger })
    modal.open('https://example.com/pay')

    // Typosquatting / lookalike domains should be rejected
    const fakeOrigins = [
      'https://cinetpay.evil.com',
      'https://fakecinetpay.net',
      'https://secure.cinetpay.net.evil.com',
      'https://cinetpay.com.attacker.io',
    ]

    for (const origin of fakeOrigins) {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin,
          data: { status: 'ACCEPTED', amount: 999, transaction_id: 'FAKE' },
        }),
      )
    }

    expect(onPaymentSuccess).not.toHaveBeenCalled()
  })

  it('accepts messages from all valid CinetPay origins', () => {
    const validOrigins = [
      'https://secure.cinetpay.net',
      'https://secure.cinetpay.com',
      'https://checkout.cinetpay.net',
      'https://checkout.cinetpay.com',
      'https://api.cinetpay.net',
      'https://api.cinetpay.co',
    ]

    for (const origin of validOrigins) {
      const onPaymentSuccess = vi.fn()
      const modal = new Modal({ onPaymentSuccess, closeAfterResponse: false, logger: noopLogger })
      modal.open('https://example.com/pay')

      window.dispatchEvent(
        new MessageEvent('message', {
          origin,
          data: { status: 'ACCEPTED', amount: 100, currency: 'XOF', transaction_id: 'TX' },
        }),
      )

      expect(onPaymentSuccess).toHaveBeenCalled()
      modal.close()
    }
  })

  it('iframe does not have allow-top-navigation', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    const iframe = document.querySelector('iframe')
    const sandbox = iframe?.getAttribute('sandbox') ?? ''
    expect(sandbox).not.toContain('allow-top-navigation')
    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).toContain('allow-same-origin')
  })

  it('iframe has referrerpolicy', () => {
    const modal = new Modal({ logger: noopLogger })
    modal.open('https://example.com/pay')

    const iframe = document.querySelector('iframe')
    expect(iframe?.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('ignores non-JSON string messages', () => {
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentSuccess, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: 'not valid json {{{',
      }),
    )

    expect(onPaymentSuccess).not.toHaveBeenCalled()
  })

  it('parses JSON string messages', () => {
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentSuccess, closeAfterResponse: false, logger: noopLogger })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: JSON.stringify({
          status: 'ACCEPTED',
          amount: 2000,
          currency: 'XAF',
          transaction_id: 'TX-json',
        }),
      }),
    )

    expect(onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACCEPTED', amount: 2000 }),
    )
  })

  it('removes message listener after close', () => {
    vi.useFakeTimers()
    const onPaymentSuccess = vi.fn()
    const modal = new Modal({ onPaymentSuccess, logger: noopLogger })
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 100, transaction_id: 'TX' },
      }),
    )

    expect(onPaymentSuccess).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
