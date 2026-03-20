import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from '../src/emitter'

describe('EventEmitter', () => {
  it('calls handler when event is emitted', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('payment.success', handler)

    emitter.emit('payment.success', {
      amount: 1000, currency: 'XOF', status: 'ACCEPTED',
      paymentMethod: 'OM', description: '', transactionId: 'TX',
    })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000, status: 'ACCEPTED' }),
    )
  })

  it('supports multiple handlers for same event', () => {
    const emitter = new EventEmitter()
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    emitter.on('payment.success', handler1)
    emitter.on('payment.success', handler2)

    emitter.emit('payment.success', {
      amount: 500, currency: 'XOF', status: 'ACCEPTED',
      paymentMethod: '', description: '', transactionId: 'TX',
    })

    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  it('on() returns unsubscribe function', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    const unsub = emitter.on('payment.success', handler)

    unsub()

    emitter.emit('payment.success', {
      amount: 100, currency: 'XOF', status: 'ACCEPTED',
      paymentMethod: '', description: '', transactionId: 'TX',
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('off() removes a specific handler', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('payment.failed', handler)
    emitter.off('payment.failed', handler)

    emitter.emit('payment.failed', {
      amount: 100, currency: 'XOF', status: 'REFUSED',
      paymentMethod: '', description: '', transactionId: 'TX',
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('once() calls handler only once', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.once('close', handler)

    emitter.emit('close', { status: 'ACCEPTED' })
    emitter.emit('close', { status: 'REFUSED' })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ status: 'ACCEPTED' })
  })

  it('handles void events (ready)', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('ready', handler)

    emitter.emit('ready')

    expect(handler).toHaveBeenCalledOnce()
  })

  it('handles error events', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('error', handler)

    emitter.emit('error', { code: 'ERR', message: 'Test error' })

    expect(handler).toHaveBeenCalledWith({ code: 'ERR', message: 'Test error' })
  })

  it('handles payment.pending events', () => {
    const emitter = new EventEmitter()
    const handler = vi.fn()
    emitter.on('payment.pending', handler)

    emitter.emit('payment.pending', {
      amount: 500, currency: 'XOF', status: 'PENDING',
      paymentMethod: '', description: '', transactionId: 'TX',
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
    )
  })

  it('does not call handlers for different events', () => {
    const emitter = new EventEmitter()
    const successHandler = vi.fn()
    const failedHandler = vi.fn()
    emitter.on('payment.success', successHandler)
    emitter.on('payment.failed', failedHandler)

    emitter.emit('payment.success', {
      amount: 100, currency: 'XOF', status: 'ACCEPTED',
      paymentMethod: '', description: '', transactionId: 'TX',
    })

    expect(successHandler).toHaveBeenCalled()
    expect(failedHandler).not.toHaveBeenCalled()
  })

  it('removeAll() clears all handlers', () => {
    const emitter = new EventEmitter()
    const h1 = vi.fn()
    const h2 = vi.fn()
    emitter.on('payment.success', h1)
    emitter.on('close', h2)

    emitter.removeAll()

    emitter.emit('payment.success', {
      amount: 100, currency: 'XOF', status: 'ACCEPTED',
      paymentMethod: '', description: '', transactionId: 'TX',
    })
    emitter.emit('close', { status: 'test' })

    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('does not throw if handler throws', () => {
    const emitter = new EventEmitter()
    emitter.on('ready', () => { throw new Error('boom') })
    const handler2 = vi.fn()
    emitter.on('ready', handler2)

    expect(() => emitter.emit('ready')).not.toThrow()
    expect(handler2).toHaveBeenCalled()
  })

  it('does not throw if emitting event with no handlers', () => {
    const emitter = new EventEmitter()
    expect(() => emitter.emit('ready')).not.toThrow()
  })
})

describe('CinetPaySeamless event integration', () => {
  it('on() is exposed on CinetPaySeamless', async () => {
    const { CinetPaySeamless } = await import('../src/index')
    expect(typeof CinetPaySeamless.on).toBe('function')
    expect(typeof CinetPaySeamless.off).toBe('function')
    expect(typeof CinetPaySeamless.once).toBe('function')
  })
})
