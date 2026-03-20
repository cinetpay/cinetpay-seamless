import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Modal } from '../src/modal'

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
    const modal = new Modal({})
    modal.open('https://secure.cinetpay.net/checkout/test-token')

    const overlay = document.querySelector('.cp-seamless-overlay')
    expect(overlay).not.toBeNull()
  })

  it('injects styles into head', () => {
    const modal = new Modal({})
    modal.open('https://secure.cinetpay.net/checkout/test-token')

    const style = document.getElementById('cp-seamless-styles')
    expect(style).not.toBeNull()
    expect(style?.tagName).toBe('STYLE')
  })

  it('does not duplicate styles on multiple opens', () => {
    const modal1 = new Modal({})
    modal1.open('https://example.com/pay1')

    const modal2 = new Modal({})
    modal2.open('https://example.com/pay2')

    const styles = document.querySelectorAll('#cp-seamless-styles')
    expect(styles.length).toBe(1)
  })

  it('creates an iframe with the payment URL', () => {
    const modal = new Modal({})
    modal.open('https://secure.cinetpay.net/checkout/abc123')

    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.src).toBe('https://secure.cinetpay.net/checkout/abc123')
  })

  it('sets sandbox attribute on iframe', () => {
    const modal = new Modal({})
    modal.open('https://secure.cinetpay.net/checkout/abc123')

    const iframe = document.querySelector('iframe')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-same-origin')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-forms')
  })

  it('blocks body scroll when open', () => {
    const modal = new Modal({})
    modal.open('https://example.com/pay')

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body scroll after close', () => {
    vi.useFakeTimers()
    const modal = new Modal({})
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)
    expect(document.body.style.overflow).toBe('')
    vi.useRealTimers()
  })

  it('removes overlay from DOM after close', () => {
    vi.useFakeTimers()
    const modal = new Modal({})
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
    const modal = new Modal({ onClose })
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalledWith({ status: 'UNKNOWN' })
    vi.useRealTimers()
  })

  it('closes when clicking overlay background', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const modal = new Modal({ onClose })
    modal.open('https://example.com/pay')

    const overlay = document.querySelector('.cp-seamless-overlay') as HTMLElement
    overlay.click()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not close when clicking modal content', () => {
    const onClose = vi.fn()
    const modal = new Modal({ onClose })
    modal.open('https://example.com/pay')

    const modalEl = document.querySelector('.cp-seamless-modal') as HTMLElement
    modalEl.click()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when clicking close button', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const modal = new Modal({ onClose })
    modal.open('https://example.com/pay')

    const closeBtn = document.querySelector('.cp-seamless-close') as HTMLElement
    closeBtn.click()

    vi.advanceTimersByTime(500)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('applies dark theme class', () => {
    const modal = new Modal({ theme: 'dark' })
    modal.open('https://example.com/pay')

    const modalEl = document.querySelector('.cp-seamless-modal')
    expect(modalEl?.classList.contains('cp-dark')).toBe(true)
  })

  it('applies light theme by default', () => {
    const modal = new Modal({})
    modal.open('https://example.com/pay')

    const modalEl = document.querySelector('.cp-seamless-modal')
    expect(modalEl?.classList.contains('cp-dark')).toBe(false)
  })

  it('shows loading spinner initially', () => {
    const modal = new Modal({})
    modal.open('https://example.com/pay')

    expect(document.querySelector('.cp-seamless-loading')).not.toBeNull()
    expect(document.querySelector('.cp-seamless-spinner')).not.toBeNull()
  })

  it('shows CinetPay logo in header', () => {
    const modal = new Modal({})
    modal.open('https://example.com/pay')

    const logo = document.querySelector('.cp-seamless-logo')
    expect(logo).not.toBeNull()
    expect(logo?.querySelector('svg')).not.toBeNull()
  })

  it('shows footer with security text', () => {
    const modal = new Modal({})
    modal.open('https://example.com/pay')

    const footer = document.querySelector('.cp-seamless-footer')
    expect(footer).not.toBeNull()
    expect(footer?.textContent).toContain('CinetPay')
  })

  it('handles postMessage ACCEPTED response', () => {
    const onResponse = vi.fn()
    const modal = new Modal({ onResponse, closeAfterResponse: false })
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

    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACCEPTED',
        amount: 1000,
        currency: 'XOF',
        paymentMethod: 'OM',
        transactionId: 'TX-123',
      }),
    )
  })

  it('handles REFUSED status', () => {
    const onResponse = vi.fn()
    const modal = new Modal({ onResponse, closeAfterResponse: false })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'REFUSED', amount: 500, currency: 'XOF', transaction_id: 'TX-456' },
      }),
    )

    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REFUSED' }),
    )
  })

  it('shows success result screen on closeAfterResponse', () => {
    const modal = new Modal({ closeAfterResponse: true })
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
    const modal = new Modal({ closeAfterResponse: true })
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
    const modal = new Modal({ onError })
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
    const onResponse = vi.fn()
    const modal = new Modal({ onResponse })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { status: 'ACCEPTED', amount: 999 },
      }),
    )

    expect(onResponse).not.toHaveBeenCalled()
  })

  it('ignores non-JSON string messages', () => {
    const onResponse = vi.fn()
    const modal = new Modal({ onResponse })
    modal.open('https://example.com/pay')

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: 'not valid json {{{',
      }),
    )

    expect(onResponse).not.toHaveBeenCalled()
  })

  it('parses JSON string messages', () => {
    const onResponse = vi.fn()
    const modal = new Modal({ onResponse, closeAfterResponse: false })
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

    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACCEPTED', amount: 2000 }),
    )
  })

  it('removes message listener after close', () => {
    vi.useFakeTimers()
    const onResponse = vi.fn()
    const modal = new Modal({ onResponse })
    modal.open('https://example.com/pay')
    modal.close()

    vi.advanceTimersByTime(500)

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://secure.cinetpay.net',
        data: { status: 'ACCEPTED', amount: 100, transaction_id: 'TX' },
      }),
    )

    expect(onResponse).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
