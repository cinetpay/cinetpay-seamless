import { describe, it, expect, vi } from 'vitest'
import { Logger } from '../src/logger'

describe('Logger', () => {
  describe('disabled (debug: false)', () => {
    it('does not log debug', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logger = new Logger(false)
      logger.debug('test')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('does not log warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logger = new Logger(false)
      logger.warn('test')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('does not log error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new Logger(false)
      logger.error('test')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('enabled (debug: true)', () => {
    it('logs debug without data', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logger = new Logger(true)
      logger.debug('hello')
      expect(spy).toHaveBeenCalledWith('[CinetPay Seamless] hello')
      spy.mockRestore()
    })

    it('logs debug with data', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const logger = new Logger(true)
      logger.debug('hello', { key: 'value' })
      expect(spy).toHaveBeenCalledWith('[CinetPay Seamless] hello', { key: 'value' })
      spy.mockRestore()
    })

    it('logs warn without data', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logger = new Logger(true)
      logger.warn('warning')
      expect(spy).toHaveBeenCalledWith('[CinetPay Seamless] warning')
      spy.mockRestore()
    })

    it('logs warn with data', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logger = new Logger(true)
      logger.warn('warning', { detail: 'info' })
      expect(spy).toHaveBeenCalledWith('[CinetPay Seamless] warning', { detail: 'info' })
      spy.mockRestore()
    })

    it('logs error without data', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new Logger(true)
      logger.error('fail')
      expect(spy).toHaveBeenCalledWith('[CinetPay Seamless] fail')
      spy.mockRestore()
    })

    it('logs error with data', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new Logger(true)
      logger.error('fail', { code: 500 })
      expect(spy).toHaveBeenCalledWith('[CinetPay Seamless] fail', { code: 500 })
      spy.mockRestore()
    })
  })
})
