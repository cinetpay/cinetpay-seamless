import { STYLES } from './styles'
import type { PaymentResponse, PaymentError, PaymentStatus } from './types'
import { Logger } from './logger'
import { EventEmitter } from './emitter'

type StatusChecker = () => Promise<unknown>

/** @internal Options du constructeur Checkout */
export interface CheckoutOptions {
  onReady?: () => void
  onPaymentSuccess?: (data: PaymentResponse) => void
  onPaymentFailed?: (data: PaymentResponse) => void
  onPaymentPending?: (data: PaymentResponse) => void
  onClose?: (data: { status: string }) => void
  onError?: (error: PaymentError) => void
  statusChecker?: StatusChecker
  statusPollInterval?: number
  logger: Logger
  emitter: EventEmitter
}

/** @internal Intervalle de polling pour vérifier si la popup est fermée */
const POPUP_POLL_INTERVAL = 500
/** @internal Intervalle par défaut pour vérifier le statut via le backend marchand */
const STATUS_POLL_INTERVAL = 3000
/** @internal Évite un polling trop agressif depuis le navigateur */
const MIN_STATUS_POLL_INTERVAL = 1000

/**
 * Gère le checkout CinetPay via une popup window + overlay.
 *
 * Flow :
 * 1. Affiche un overlay sombre avec un message d'attente
 * 2. Ouvre la page de checkout dans une popup (window.open)
 * 3. Poll la popup pour détecter sa fermeture
 * 4. Écoute les messages postMessage de la popup
 * 5. Ferme l'overlay et dispatche les callbacks
 *
 * @internal Utilisé par {@link CinetPaySeamless}. Ne pas instancier directement.
 */
export class Checkout {
  private overlay: HTMLDivElement | null = null
  private popup: Window | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private statusTimer: ReturnType<typeof setInterval> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private messageHandler: ((event: MessageEvent) => void) | null = null
  private lastStatus = 'UNKNOWN'
  private lastDispatchKey = ''
  private finalStatusDispatched = false
  private statusCheckInFlight = false
  private isClosing = false
  private previousBodyOverflow = ''

  private onReadyCallback?: () => void
  private onPaymentSuccessCallback?: (data: PaymentResponse) => void
  private onPaymentFailedCallback?: (data: PaymentResponse) => void
  private onPaymentPendingCallback?: (data: PaymentResponse) => void
  private onCloseCallback?: (data: { status: string }) => void
  private onErrorCallback?: (error: PaymentError) => void
  private statusChecker?: StatusChecker
  private statusPollInterval: number
  private logger: Logger
  private emitter: EventEmitter

  constructor(options: CheckoutOptions) {
    this.logger = options.logger
    this.emitter = options.emitter
    this.onReadyCallback = options.onReady
    this.onPaymentSuccessCallback = options.onPaymentSuccess
    this.onPaymentFailedCallback = options.onPaymentFailed
    this.onPaymentPendingCallback = options.onPaymentPending
    this.onCloseCallback = options.onClose
    this.onErrorCallback = options.onError
    this.statusChecker = options.statusChecker
    this.statusPollInterval = Math.max(
      MIN_STATUS_POLL_INTERVAL,
      options.statusPollInterval ?? STATUS_POLL_INTERVAL,
    )
  }

  /**
   * Ouvre la popup de checkout et affiche l'overlay d'attente.
   *
   * @param paymentUrl - URL complète de la page de checkout CinetPay
   */
  open(paymentUrl: string): void {
    this.logger.debug('Opening checkout popup', { paymentUrl })
    this.injectStyles()
    this.createOverlay()
    this.openPopup(paymentUrl)
    if (!this.popup) return

    this.listenForMessages()
    this.startPolling()
    this.startStatusPolling()

    requestAnimationFrame(() => {
      this.overlay?.classList.add('cp-visible')
    })

    this.previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  /**
   * Ferme la popup et l'overlay.
   */
  close(): void {
    if (this.closeTimer || this.isClosing) return

    if (!this.statusChecker || this.finalStatusDispatched) {
      this.finishClose()
      return
    }

    this.isClosing = true

    void this.checkStatus('close').finally(() => {
      this.finishClose()
    })
  }

  private finishClose(): void {
    if (this.closeTimer) return
    this.stopPolling()
    this.stopStatusPolling()

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }

    if (this.popup && !this.popup.closed) {
      this.popup.close()
    }
    this.popup = null

    if (this.overlay) {
      const overlay = this.overlay
      this.overlay = null
      overlay.classList.remove('cp-visible')
      this.closeTimer = setTimeout(() => {
        overlay.remove()
        this.closeTimer = null
        this.isClosing = false

        if (!document.querySelector('.cp-seamless-overlay')) {
          document.body.style.overflow = this.previousBodyOverflow
        }

        this.logger.debug('Checkout closed', { lastStatus: this.lastStatus })
        this.emitter.emit('close', { status: this.lastStatus })
        this.onCloseCallback?.({ status: this.lastStatus })
      }, 300)
    } else {
      this.isClosing = false
    }
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  private static childRecords(data: Record<string, unknown>): Record<string, unknown>[] {
    const records: Record<string, unknown>[] = []
    for (const key of ['details', 'transaction', 'payment', 'result', 'data']) {
      const child = data[key]
      if (Checkout.isRecord(child)) records.push(child)
    }
    records.push(data)
    return records
  }

  private static findValue(data: Record<string, unknown>, keys: string[]): unknown {
    for (const record of Checkout.childRecords(data)) {
      for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null) return record[key]
      }
    }
    return undefined
  }

  private static asString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined
    return String(value)
  }

  private static asNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/\s/g, ''))
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  private static asOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
    if (typeof value === 'string') {
      const parsed = Number(value.trim())
      return Number.isFinite(parsed) ? parsed : undefined
    }
    return undefined
  }

  private static normalizeStatus(rawStatus?: string, apiCode?: number): PaymentStatus {
    const normalized = rawStatus?.trim().toUpperCase().replace(/[\s-]+/g, '_')

    if (normalized) {
      if (['ACCEPTED', 'SUCCESS', 'SUCCEEDED', 'SUCCESSFUL', 'PAID', 'VALIDATED', 'APPROVED'].includes(normalized)) {
        return 'ACCEPTED'
      }
      if ([
        'REFUSED',
        'FAILED',
        'FAIL',
        'FAILURE',
        'DENIED',
        'DECLINED',
        'REJECTED',
        'CANCELED',
        'CANCELLED',
        'CANCEL',
        'INSUFFICIENT_BALANCE',
      ].includes(normalized)) {
        return 'REFUSED'
      }
      if (['PENDING', 'INITIATED', 'EXPIRED'].includes(normalized)) {
        return normalized as PaymentStatus
      }
      if (['WAITING', 'PROCESSING', 'IN_PROGRESS'].includes(normalized)) {
        return 'PENDING'
      }
    }

    switch (apiCode) {
      case 100:
        return 'ACCEPTED'
      case 2010:
      case 2005:
        return 'REFUSED'
      case 2001:
        return 'INITIATED'
      case 2002:
        return 'PENDING'
      case 2003:
        return 'EXPIRED'
    }

    return 'UNKNOWN'
  }

  private static isFinalStatus(status: PaymentStatus): boolean {
    return status === 'ACCEPTED' || status === 'REFUSED'
  }

  private static buildPaymentResponse(data: Record<string, unknown>): PaymentResponse {
    const rawStatus = Checkout.asString(Checkout.findValue(data, [
      'status',
      'transaction_status',
      'trans_status',
      'payment_status',
    ]))
    const apiCode = Checkout.asOptionalNumber(Checkout.findValue(data, ['code']))
    const status = Checkout.normalizeStatus(rawStatus, apiCode)

    return {
      amount: Checkout.asNumber(Checkout.findValue(data, ['amount'])),
      currency: Checkout.asString(Checkout.findValue(data, ['currency'])) ?? '',
      status,
      rawStatus,
      apiCode,
      paymentMethod: Checkout.asString(Checkout.findValue(data, ['payment_method', 'paymentMethod'])) ?? '',
      description: Checkout.asString(Checkout.findValue(data, ['description', 'designation', 'message'])) ?? '',
      metadata: Checkout.asString(Checkout.findValue(data, ['metadata', 'custom'])),
      operatorId: Checkout.asString(Checkout.findValue(data, ['operator_id', 'operatorId'])),
      paymentDate: Checkout.asString(Checkout.findValue(data, ['payment_date', 'paymentDate'])),
      transactionId: Checkout.asString(Checkout.findValue(data, ['transaction_id', 'transactionId', 'merchant_transaction_id'])) ?? '',
    }
  }

  /** Dispatche la réponse vers le bon callback selon le statut. */
  private dispatchResponse(response: PaymentResponse): void {
    const dispatchKey = `${response.status}:${response.rawStatus ?? ''}:${response.apiCode ?? ''}`
    const isFinalStatus = Checkout.isFinalStatus(response.status)

    if (isFinalStatus && this.finalStatusDispatched) return
    if (dispatchKey === this.lastDispatchKey) return

    this.lastDispatchKey = dispatchKey
    this.lastStatus = response.status
    if (isFinalStatus) {
      this.finalStatusDispatched = true
      this.stopStatusPolling()
    }

    this.logger.debug(`Payment response: ${response.status}`, {
      amount: response.amount,
      currency: response.currency,
      transactionId: response.transactionId,
      paymentMethod: response.paymentMethod,
    })

    switch (response.status) {
      case 'ACCEPTED':
        this.logger.debug('Payment accepted')
        this.emitter.emit('payment.success', response)
        this.onPaymentSuccessCallback?.(response)
        break
      case 'REFUSED':
        this.logger.warn('Payment refused')
        this.emitter.emit('payment.failed', response)
        this.onPaymentFailedCallback?.(response)
        break
      case 'PENDING':
      case 'INITIATED':
      case 'EXPIRED':
      default:
        this.logger.debug(`Payment pending: ${response.status}`)
        this.emitter.emit('payment.pending', response)
        this.onPaymentPendingCallback?.(response)
        break
    }
  }

  private injectStyles(): void {
    if (document.getElementById('cp-seamless-styles')) return
    const styleEl = document.createElement('style')
    styleEl.id = 'cp-seamless-styles'
    styleEl.textContent = STYLES
    document.head.appendChild(styleEl)
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div')
    this.overlay.className = 'cp-seamless-overlay'

    const wrapper = document.createElement('div')
    wrapper.className = 'cp-seamless-wrapper'

    // Spinner + message
    const waiting = document.createElement('div')
    waiting.className = 'cp-seamless-waiting'

    const spinner = document.createElement('div')
    spinner.className = 'cp-seamless-spinner'
    waiting.appendChild(spinner)

    const title = document.createElement('p')
    title.className = 'cp-seamless-waiting-title'
    title.textContent = 'Paiement en cours...'
    waiting.appendChild(title)

    const msg = document.createElement('p')
    msg.className = 'cp-seamless-waiting-msg'
    msg.textContent = 'Finalisez votre paiement dans la fenêtre CinetPay.'
    waiting.appendChild(msg)

    // Bouton fermer
    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'cp-seamless-cancel-btn'
    cancelBtn.textContent = 'Annuler'
    cancelBtn.addEventListener('click', () => this.close())
    waiting.appendChild(cancelBtn)

    wrapper.appendChild(waiting)
    this.overlay.appendChild(wrapper)
    document.body.appendChild(this.overlay)
  }

  /**
   * Ouvre la popup centrée sur l'écran.
   */
  private openPopup(paymentUrl: string): void {
    const width = 500
    const height = 700
    const left = Math.max(0, (screen.width - width) / 2)
    const top = Math.max(0, (screen.height - height) / 2)

    this.popup = window.open(
      paymentUrl,
      'CinetPayCheckout',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    )

    if (!this.popup) {
      this.logger.error('Popup blocked by browser')
      const err: PaymentError = {
        code: 'POPUP_BLOCKED',
        message: 'La fenêtre de paiement a été bloquée par le navigateur. Autorisez les popups pour ce site.',
      }
      this.emitter.emit('error', err)
      this.onErrorCallback?.(err)
      this.close()
      return
    }

    this.logger.debug('Popup opened')
    this.emitter.emit('ready')
    this.onReadyCallback?.()
  }

  /**
   * Poll toutes les 500ms pour détecter si la popup a été fermée
   * (par l'utilisateur ou après redirection).
   */
  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      if (this.popup && this.popup.closed) {
        this.logger.debug('Popup closed by user or redirect')
        this.stopPolling()

        // Laisser un court délai pour que le postMessage arrive avant le close
        setTimeout(() => {
          if (this.overlay) {
            this.close()
          }
        }, 500)
      }
    }, POPUP_POLL_INTERVAL)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private startStatusPolling(): void {
    if (!this.statusChecker) return

    void this.checkStatus('open')

    this.statusTimer = setInterval(() => {
      void this.checkStatus('interval')
    }, this.statusPollInterval)
  }

  private stopStatusPolling(): void {
    if (this.statusTimer) {
      clearInterval(this.statusTimer)
      this.statusTimer = null
    }
  }

  private async checkStatus(reason: string): Promise<void> {
    if (!this.statusChecker || this.statusCheckInFlight || this.finalStatusDispatched) return

    this.statusCheckInFlight = true
    try {
      this.logger.debug('Checking payment status', { reason })
      const data = await this.statusChecker()
      if (!Checkout.isRecord(data)) return

      const response = Checkout.buildPaymentResponse(data)
      const rawStatus = response.rawStatus?.trim().toUpperCase()
      if (response.status !== 'UNKNOWN' || (rawStatus && rawStatus !== 'OK')) {
        this.dispatchResponse(response)
      }

      if (Checkout.isFinalStatus(response.status)) {
        this.finishClose()
      }
    } catch (error) {
      this.logger.warn('Payment status check failed', error)
    } finally {
      this.statusCheckInFlight = false
    }
  }

  /** Origines autorisées pour les messages postMessage */
  private static readonly ALLOWED_ORIGINS = [
    'https://secure.cinetpay.net',
    'https://secure.cinetpay.com',
    'https://checkout.cinetpay.net',
    'https://checkout.cinetpay.com',
    'https://api.cinetpay.net',
    'https://api.cinetpay.co',
  ]

  /** Écoute les messages postMessage de la popup CinetPay. */
  private listenForMessages(): void {
    this.messageHandler = (event: MessageEvent) => {
      if (!Checkout.ALLOWED_ORIGINS.some((o) => event.origin === o)) {
        return
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (!Checkout.isRecord(data)) return

        const response = Checkout.buildPaymentResponse(data)
        const rawStatus = response.rawStatus?.trim().toUpperCase()
        if (response.status !== 'UNKNOWN' || (rawStatus && rawStatus !== 'OK')) {
          this.dispatchResponse(response)
        }

        const error = Checkout.findValue(data, ['error'])
        const code = Checkout.asString(Checkout.findValue(data, ['code']))
        if (error || code === 'ERROR') {
          const err: PaymentError = {
            code: code ?? 'UNKNOWN',
            message: Checkout.asString(Checkout.findValue(data, ['message'])) ?? Checkout.asString(error) ?? 'An error occurred',
          }
          this.logger.error('Payment error from popup', err)
          this.emitter.emit('error', err)
          this.onErrorCallback?.(err)
        }

        if (data.action === 'CLOSE' || data.type === 'close') {
          this.close()
        }
      } catch {
        // Ignorer les messages non-JSON
      }
    }

    window.addEventListener('message', this.messageHandler)
  }
}
