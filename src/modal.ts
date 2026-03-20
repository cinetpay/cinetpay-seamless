import { STYLES } from './styles'
import type { PaymentResponse, PaymentError, PaymentStatus } from './types'
import { Logger } from './logger'
import { EventEmitter } from './emitter'

/** @internal Chemin SVG de l'icône de fermeture (croix) */
const CLOSE_ICON_PATH = 'M2,2 L14,14 M14,2 L2,14'

/** @internal Options du constructeur Modal */
interface ModalOptions {
  theme?: 'light' | 'dark'
  closeAfterResponse?: boolean
  onReady?: () => void
  onPaymentSuccess?: (data: PaymentResponse) => void
  onPaymentFailed?: (data: PaymentResponse) => void
  onPaymentPending?: (data: PaymentResponse) => void
  onClose?: (data: { status: string }) => void
  onError?: (error: PaymentError) => void
  /** Instance du logger */
  logger: Logger
  /** Event emitter partagé */
  emitter: EventEmitter
}

/**
 * Modal de paiement CinetPay.
 *
 * Crée un overlay plein écran avec un modal contenant un iframe
 * pointant vers la passerelle de paiement CinetPay. Gère les
 * animations d'ouverture/fermeture, les thèmes, le spinner de
 * chargement, l'écran de résultat, et l'écoute des messages
 * `postMessage` depuis l'iframe.
 *
 * @internal Utilisé en interne par {@link CinetPaySeamless}. Ne pas instancier directement.
 */
export class Modal {
  /** Élément overlay qui couvre tout l'écran */
  private overlay: HTMLDivElement | null = null
  /** Iframe contenant la page de paiement CinetPay */
  private iframe: HTMLIFrameElement | null = null
  /** Élément `<style>` injecté dans le `<head>` */
  private styleEl: HTMLStyleElement | null = null
  /** Callbacks */
  private onReadyCallback?: () => void
  private onPaymentSuccessCallback?: (data: PaymentResponse) => void
  private onPaymentFailedCallback?: (data: PaymentResponse) => void
  private onPaymentPendingCallback?: (data: PaymentResponse) => void
  private onCloseCallback?: (data: { status: string }) => void
  private onErrorCallback?: (error: PaymentError) => void
  /** Fermer automatiquement le modal après affichage du résultat */
  private closeAfterResponse: boolean
  /** Thème visuel du modal */
  private theme: 'light' | 'dark'
  /** Dernier statut de paiement reçu (transmis au callback onClose) */
  private lastStatus = 'UNKNOWN'
  /** Référence au handler postMessage pour pouvoir le supprimer */
  private messageHandler: ((event: MessageEvent) => void) | null = null
  /** Logger interne */
  private logger: Logger
  /** Event emitter partagé */
  private emitter: EventEmitter

  /**
   * Crée une nouvelle instance de modal.
   *
   * @param options - Options de configuration du modal
   */
  constructor(options: ModalOptions) {
    this.theme = options.theme ?? 'light'
    this.closeAfterResponse = options.closeAfterResponse ?? true
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
   * Ouvre le modal avec l'URL de la passerelle de paiement.
   *
   * @param paymentUrl - URL complète de la page de checkout CinetPay
   */
  open(paymentUrl: string): void {
    this.logger.debug('Opening modal', { paymentUrl })
    this.injectStyles()
    this.createOverlay()
    this.createModal(paymentUrl)
    this.listenForMessages()

    requestAnimationFrame(() => {
      this.overlay?.classList.add('cp-visible')
    })

    document.body.style.overflow = 'hidden'
  }

  /**
   * Ferme le modal avec une animation de 300ms.
   * Nettoie l'overlay, l'iframe, le listener postMessage,
   * et restaure le scroll du body.
   */
  close(): void {
    if (!this.overlay) return

    this.overlay.classList.remove('cp-visible')

    setTimeout(() => {
      this.overlay?.remove()
      this.overlay = null
      this.iframe = null
      document.body.style.overflow = ''

      if (this.messageHandler) {
        window.removeEventListener('message', this.messageHandler)
        this.messageHandler = null
      }

      this.logger.debug('Modal closed', { lastStatus: this.lastStatus })
      this.emitter.emit('close', { status: this.lastStatus })
      this.onCloseCallback?.({ status: this.lastStatus })
    }, 300)
  }

  /**
   * Dispatche la réponse de paiement vers le bon callback selon le statut.
   *
   * @param response - Réponse de paiement normalisée
   */
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

    if (this.closeAfterResponse && (response.status === 'ACCEPTED' || response.status === 'REFUSED')) {
      this.showResult(response)
    }
  }

  /**
   * Affiche l'écran de résultat (succès ou échec) dans le modal.
   *
   * @param response - Réponse de paiement reçue de CinetPay
   */
  private showResult(response: PaymentResponse): void {
    const content = this.overlay?.querySelector('.cp-seamless-content')
    if (!content) return

    const isSuccess = response.status === 'ACCEPTED'
    const lang = document.documentElement.lang?.startsWith('en') ? 'en' : 'fr'

    while (content.firstChild) content.removeChild(content.firstChild)

    const result = document.createElement('div')
    result.className = 'cp-seamless-result'

    const icon = document.createElement('div')
    icon.className = `cp-seamless-result-icon ${isSuccess ? 'cp-success' : 'cp-failure'}`
    icon.textContent = isSuccess ? '\u2713' : '\u2717'
    result.appendChild(icon)

    const title = document.createElement('h3')
    title.className = 'cp-seamless-result-title'
    title.textContent = isSuccess
      ? (lang === 'fr' ? 'Paiement réussi' : 'Payment successful')
      : (lang === 'fr' ? 'Paiement échoué' : 'Payment failed')
    result.appendChild(title)

    const message = document.createElement('p')
    message.className = 'cp-seamless-result-message'
    message.textContent = isSuccess
      ? (lang === 'fr'
        ? `${response.amount} ${response.currency} payés avec succès`
        : `${response.amount} ${response.currency} paid successfully`)
      : (lang === 'fr' ? 'Le paiement n\'a pas pu être traité' : 'The payment could not be processed')
    result.appendChild(message)

    const btn = document.createElement('button')
    btn.className = 'cp-seamless-result-btn'
    btn.textContent = lang === 'fr' ? 'Fermer' : 'Close'
    btn.addEventListener('click', () => this.close())
    result.appendChild(btn)

    content.appendChild(result)
  }

  /** Injecte les styles CSS dans le `<head>` (une seule fois). */
  private injectStyles(): void {
    if (document.getElementById('cp-seamless-styles')) return
    this.styleEl = document.createElement('style')
    this.styleEl.id = 'cp-seamless-styles'
    this.styleEl.textContent = STYLES
    document.head.appendChild(this.styleEl)
  }

  /** Crée l'overlay semi-transparent. */
  private createOverlay(): void {
    this.overlay = document.createElement('div')
    this.overlay.className = 'cp-seamless-overlay'
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    document.body.appendChild(this.overlay)
  }

  /**
   * Crée la structure DOM du modal : header, contenu (iframe), footer.
   *
   * @param paymentUrl - URL de la page de checkout CinetPay
   */
  private createModal(paymentUrl: string): void {
    const modal = document.createElement('div')
    modal.className = `cp-seamless-modal ${this.theme === 'dark' ? 'cp-dark' : ''}`

    // Header
    const header = document.createElement('div')
    header.className = 'cp-seamless-header'

    const logoContainer = document.createElement('div')
    logoContainer.className = 'cp-seamless-logo'

    const logoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    logoSvg.setAttribute('viewBox', '0 0 120 28')
    logoSvg.setAttribute('height', '28')
    const textCinet = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    textCinet.setAttribute('x', '0')
    textCinet.setAttribute('y', '22')
    textCinet.setAttribute('font-family', '-apple-system,sans-serif')
    textCinet.setAttribute('font-size', '20')
    textCinet.setAttribute('font-weight', '700')
    textCinet.setAttribute('fill', '#e8530e')
    textCinet.textContent = 'Cinet'
    const textPay = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    textPay.setAttribute('x', '56')
    textPay.setAttribute('y', '22')
    textPay.setAttribute('font-family', '-apple-system,sans-serif')
    textPay.setAttribute('font-size', '20')
    textPay.setAttribute('font-weight', '700')
    textPay.setAttribute('fill', this.theme === 'dark' ? '#e0e0e0' : '#333')
    textPay.textContent = 'Pay'
    logoSvg.appendChild(textCinet)
    logoSvg.appendChild(textPay)
    logoContainer.appendChild(logoSvg)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'cp-seamless-close'
    closeBtn.setAttribute('aria-label', 'Fermer')
    const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    closeSvg.setAttribute('width', '16')
    closeSvg.setAttribute('height', '16')
    closeSvg.setAttribute('viewBox', '0 0 16 16')
    closeSvg.setAttribute('fill', 'none')
    closeSvg.setAttribute('stroke', 'currentColor')
    closeSvg.setAttribute('stroke-width', '2')
    closeSvg.setAttribute('stroke-linecap', 'round')
    const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    closePath.setAttribute('d', CLOSE_ICON_PATH)
    closeSvg.appendChild(closePath)
    closeBtn.appendChild(closeSvg)
    closeBtn.addEventListener('click', () => this.close())

    header.appendChild(logoContainer)
    header.appendChild(closeBtn)

    // Content
    const content = document.createElement('div')
    content.className = 'cp-seamless-content'

    const loading = document.createElement('div')
    loading.className = 'cp-seamless-loading'
    const spinner = document.createElement('div')
    spinner.className = 'cp-seamless-spinner'
    const loadingText = document.createElement('p')
    loadingText.className = 'cp-seamless-loading-text'
    loadingText.textContent = 'Chargement...'
    loading.appendChild(spinner)
    loading.appendChild(loadingText)

    this.iframe = document.createElement('iframe')
    this.iframe.src = paymentUrl
    this.iframe.style.display = 'none'
    this.iframe.setAttribute('allow', 'payment')
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups')
    this.iframe.setAttribute('referrerpolicy', 'no-referrer')
    this.iframe.addEventListener('load', () => {
      loading.remove()
      if (this.iframe) this.iframe.style.display = 'block'
      this.logger.debug('Iframe loaded — checkout ready')
      this.emitter.emit('ready')
      this.onReadyCallback?.()
    })

    content.appendChild(loading)
    content.appendChild(this.iframe)

    // Footer
    const footer = document.createElement('div')
    footer.className = 'cp-seamless-footer'
    footer.textContent = 'Paiement sécurisé par CinetPay'

    modal.appendChild(header)
    modal.appendChild(content)
    modal.appendChild(footer)
    this.overlay!.appendChild(modal)
  }

  /**
   * Liste blanche des origines autorisées pour les messages `postMessage`.
   */
  private static readonly ALLOWED_ORIGINS = [
    'https://secure.cinetpay.net',
    'https://secure.cinetpay.com',
    'https://checkout.cinetpay.net',
    'https://checkout.cinetpay.com',
    'https://api.cinetpay.net',
    'https://api.cinetpay.co',
  ]

  /**
   * Écoute les messages `postMessage` de l'iframe CinetPay.
   * Dispatche vers le bon callback selon le statut.
   */
  private listenForMessages(): void {
    this.messageHandler = (event: MessageEvent) => {
      if (!Modal.ALLOWED_ORIGINS.some((o) => event.origin === o)) {
        this.logger.warn(`postMessage ignored: origin "${event.origin}" not in whitelist`)
        return
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (!data || typeof data !== 'object') return

        // Réponse de paiement
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

        // Erreur
        if (data.error || data.code === 'ERROR') {
          const err = {
            code: data.code ?? 'UNKNOWN',
            message: data.message ?? data.error ?? 'An error occurred',
          }
          this.logger.error('Payment error from iframe', err)
          this.emitter.emit('error', err)
          this.onErrorCallback?.(err)
        }

        // Fermeture demandée par l'iframe
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
