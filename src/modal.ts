import { STYLES } from './styles'
import type { PaymentResponse, PaymentError } from './types'

const CLOSE_ICON_PATH = 'M2,2 L14,14 M14,2 L2,14'

export class Modal {
  private overlay: HTMLDivElement | null = null
  private iframe: HTMLIFrameElement | null = null
  private styleEl: HTMLStyleElement | null = null
  private onCloseCallback?: (data: { status: string }) => void
  private onResponseCallback?: (data: PaymentResponse) => void
  private onErrorCallback?: (error: PaymentError) => void
  private closeAfterResponse: boolean
  private theme: 'light' | 'dark'
  private lastStatus = 'UNKNOWN'
  private messageHandler: ((event: MessageEvent) => void) | null = null

  constructor(options: {
    theme?: 'light' | 'dark'
    closeAfterResponse?: boolean
    onResponse?: (data: PaymentResponse) => void
    onClose?: (data: { status: string }) => void
    onError?: (error: PaymentError) => void
  }) {
    this.theme = options.theme ?? 'light'
    this.closeAfterResponse = options.closeAfterResponse ?? true
    this.onResponseCallback = options.onResponse
    this.onCloseCallback = options.onClose
    this.onErrorCallback = options.onError
  }

  /** Ouvre le modal avec l'URL de la passerelle de paiement */
  open(paymentUrl: string): void {
    this.injectStyles()
    this.createOverlay()
    this.createModal(paymentUrl)
    this.listenForMessages()

    requestAnimationFrame(() => {
      this.overlay?.classList.add('cp-visible')
    })

    document.body.style.overflow = 'hidden'
  }

  /** Ferme le modal */
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

      this.onCloseCallback?.({ status: this.lastStatus })
    }, 300)
  }

  /** Affiche le résultat (succès ou échec) dans le modal */
  private showResult(response: PaymentResponse): void {
    const content = this.overlay?.querySelector('.cp-seamless-content')
    if (!content) return

    const isSuccess = response.status === 'ACCEPTED'
    const lang = document.documentElement.lang?.startsWith('en') ? 'en' : 'fr'

    // Clear content safely
    while (content.firstChild) content.removeChild(content.firstChild)

    const result = document.createElement('div')
    result.className = 'cp-seamless-result'

    // Icon
    const icon = document.createElement('div')
    icon.className = `cp-seamless-result-icon ${isSuccess ? 'cp-success' : 'cp-failure'}`
    icon.textContent = isSuccess ? '\u2713' : '\u2717'
    result.appendChild(icon)

    // Title
    const title = document.createElement('h3')
    title.className = 'cp-seamless-result-title'
    title.textContent = isSuccess
      ? (lang === 'fr' ? 'Paiement réussi' : 'Payment successful')
      : (lang === 'fr' ? 'Paiement échoué' : 'Payment failed')
    result.appendChild(title)

    // Message
    const message = document.createElement('p')
    message.className = 'cp-seamless-result-message'
    message.textContent = isSuccess
      ? (lang === 'fr'
        ? `${response.amount} ${response.currency} payés avec succès`
        : `${response.amount} ${response.currency} paid successfully`)
      : (lang === 'fr' ? 'Le paiement n\'a pas pu être traité' : 'The payment could not be processed')
    result.appendChild(message)

    // Close button
    const btn = document.createElement('button')
    btn.className = 'cp-seamless-result-btn'
    btn.textContent = lang === 'fr' ? 'Fermer' : 'Close'
    btn.addEventListener('click', () => this.close())
    result.appendChild(btn)

    content.appendChild(result)
  }

  private injectStyles(): void {
    if (document.getElementById('cp-seamless-styles')) return
    this.styleEl = document.createElement('style')
    this.styleEl.id = 'cp-seamless-styles'
    this.styleEl.textContent = STYLES
    document.head.appendChild(this.styleEl)
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div')
    this.overlay.className = 'cp-seamless-overlay'
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })
    document.body.appendChild(this.overlay)
  }

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

    // Loading
    const loading = document.createElement('div')
    loading.className = 'cp-seamless-loading'
    const spinner = document.createElement('div')
    spinner.className = 'cp-seamless-spinner'
    const loadingText = document.createElement('p')
    loadingText.className = 'cp-seamless-loading-text'
    loadingText.textContent = 'Chargement...'
    loading.appendChild(spinner)
    loading.appendChild(loadingText)

    // Iframe
    this.iframe = document.createElement('iframe')
    this.iframe.src = paymentUrl
    this.iframe.style.display = 'none'
    this.iframe.setAttribute('allow', 'payment')
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups')
    this.iframe.setAttribute('referrerpolicy', 'no-referrer')
    this.iframe.addEventListener('load', () => {
      loading.remove()
      if (this.iframe) this.iframe.style.display = 'block'
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

  /** Origines autorisées pour les messages postMessage */
  private static readonly ALLOWED_ORIGINS = [
    'https://secure.cinetpay.net',
    'https://secure.cinetpay.com',
    'https://checkout.cinetpay.net',
    'https://checkout.cinetpay.com',
    'https://api.cinetpay.net',
    'https://api.cinetpay.co',
  ]

  /** Écoute les messages postMessage de l'iframe CinetPay */
  private listenForMessages(): void {
    this.messageHandler = (event: MessageEvent) => {
      // Vérification stricte de l'origine — seuls les domaines CinetPay sont acceptés
      if (!Modal.ALLOWED_ORIGINS.some((o) => event.origin === o)) return

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (!data || typeof data !== 'object') return

        // Réponse de paiement
        if (data.status === 'ACCEPTED' || data.status === 'REFUSED') {
          this.lastStatus = data.status
          const response: PaymentResponse = {
            amount: data.amount ?? data.cpm_amount ?? 0,
            currency: data.currency ?? data.cpm_currency ?? '',
            status: data.status,
            paymentMethod: data.payment_method ?? data.cpm_payment_method ?? '',
            description: data.description ?? data.cpm_designation ?? '',
            metadata: data.metadata ?? data.cpm_custom ?? undefined,
            operatorId: data.operator_id ?? data.cpm_operator_id ?? undefined,
            paymentDate: data.payment_date ?? data.cpm_payment_date ?? undefined,
            transactionId: data.transaction_id ?? data.cpm_trans_id ?? '',
          }

          this.onResponseCallback?.(response)

          if (this.closeAfterResponse) {
            this.showResult(response)
          }
        }

        // Erreur
        if (data.error || data.code === 'ERROR') {
          this.onErrorCallback?.({
            code: data.code ?? 'UNKNOWN',
            message: data.message ?? data.error ?? 'An error occurred',
          })
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
