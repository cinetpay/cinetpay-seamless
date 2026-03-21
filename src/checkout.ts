import { STYLES } from './styles'
import type { PaymentResponse, PaymentError, PaymentStatus } from './types'
import { Logger } from './logger'
import { EventEmitter } from './emitter'

/** @internal Options du constructeur Checkout */
export interface CheckoutOptions {
  theme?: 'light' | 'dark'
  onReady?: () => void
  onPaymentSuccess?: (data: PaymentResponse) => void
  onPaymentFailed?: (data: PaymentResponse) => void
  onPaymentPending?: (data: PaymentResponse) => void
  onClose?: (data: { status: string }) => void
  onError?: (error: PaymentError) => void
  logger: Logger
  emitter: EventEmitter
  popupWidth: number
  popupHeight: number
}

/** @internal Intervalle de polling pour vérifier si la popup est fermée */
const POPUP_POLL_INTERVAL = 500

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
  private messageHandler: ((event: MessageEvent) => void) | null = null
  private lastStatus = 'UNKNOWN'

  private onReadyCallback?: () => void
  private onPaymentSuccessCallback?: (data: PaymentResponse) => void
  private onPaymentFailedCallback?: (data: PaymentResponse) => void
  private onPaymentPendingCallback?: (data: PaymentResponse) => void
  private onCloseCallback?: (data: { status: string }) => void
  private onErrorCallback?: (error: PaymentError) => void
  private logger: Logger
  private emitter: EventEmitter
  private theme: 'light' | 'dark'
  private popupWidth: number
  private popupHeight: number

  constructor(options: CheckoutOptions) {
    this.theme = options.theme ?? 'light'
    this.popupWidth = options.popupWidth
    this.popupHeight = options.popupHeight
    this.logger = options.logger
    this.emitter = options.emitter
    this.onReadyCallback = options.onReady
    this.onPaymentSuccessCallback = options.onPaymentSuccess
    this.onPaymentFailedCallback = options.onPaymentFailed
    this.onPaymentPendingCallback = options.onPaymentPending
    this.onCloseCallback = options.onClose
    this.onErrorCallback = options.onError
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
    this.listenForMessages()
    this.startPolling()

    requestAnimationFrame(() => {
      this.overlay?.classList.add('cp-visible')
    })

    document.body.style.overflow = 'hidden'
  }

  /**
   * Ferme la popup et l'overlay.
   */
  close(): void {
    this.stopPolling()

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }

    if (this.popup && !this.popup.closed) {
      this.popup.close()
    }
    this.popup = null

    if (this.overlay) {
      this.overlay.classList.remove('cp-visible')
      setTimeout(() => {
        this.overlay?.remove()
        this.overlay = null
        document.body.style.overflow = ''

        this.logger.debug('Checkout closed', { lastStatus: this.lastStatus })
        this.emitter.emit('close', { status: this.lastStatus })
        this.onCloseCallback?.({ status: this.lastStatus })
      }, 300)
    }
  }

  /** Dispatche la réponse vers le bon callback selon le statut. */
  private dispatchResponse(response: PaymentResponse): void {
    this.lastStatus = response.status

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
    const width = this.popupWidth
    const height = this.popupHeight
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
        if (!data || typeof data !== 'object') return

        if (data.status) {
          const status = data.status as PaymentStatus
          const response: PaymentResponse = {
            amount: data.amount ?? data.cpm_amount ?? 0,
            currency: data.currency ?? data.cpm_currency ?? '',
            status,
            paymentMethod: data.payment_method ?? data.cpm_payment_method ?? '',
            description: data.description ?? data.cpm_designation ?? '',
            metadata: data.metadata ?? data.cpm_custom ?? undefined,
            operatorId: data.operator_id ?? data.cpm_operator_id ?? undefined,
            paymentDate: data.payment_date ?? data.cpm_payment_date ?? undefined,
            transactionId: data.transaction_id ?? data.cpm_trans_id ?? '',
          }
          this.dispatchResponse(response)
        }

        if (data.error || data.code === 'ERROR') {
          const err: PaymentError = {
            code: data.code ?? 'UNKNOWN',
            message: data.message ?? data.error ?? 'An error occurred',
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
