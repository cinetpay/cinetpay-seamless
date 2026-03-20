import { Modal } from './modal'
import type {
  SeamlessConfig,
  DirectConfig,
  BackendConfig,
  CommonConfig,
  PaymentResponse,
  PaymentError,
} from './types'
import { isDirectConfig, isBackendConfig } from './types'

// Re-export types
export type {
  SeamlessConfig,
  DirectConfig,
  BackendConfig,
  CommonConfig,
  PaymentResponse,
  PaymentError,
}

const CHECKOUT_BASE_URL_SANDBOX = 'https://api-checkout.cinetpay.com'
const CHECKOUT_BASE_URL_PROD = 'https://api-checkout.cinetpay.com'
const SECURE_BASE_URL = 'https://secure.cinetpay.net'

/**
 * CinetPay Seamless — intégration de paiement inline sans redirection.
 *
 * Deux modes d'utilisation :
 *
 * **Mode Backend** — le serveur initialise le paiement et passe le token :
 * ```typescript
 * CinetPaySeamless.open({ paymentToken: 'token-du-backend' })
 * ```
 *
 * **Mode Direct** — le frontend appelle l'API CinetPay directement :
 * ```typescript
 * CinetPaySeamless.open({
 *   apiKey: 'sk_test_...',
 *   siteId: 123456,
 *   transactionId: 'ORDER-001',
 *   amount: 1000,
 *   currency: 'XOF',
 *   description: 'Achat',
 *   notifyUrl: 'https://monsite.com/webhook',
 * })
 * ```
 */
export const CinetPaySeamless = {
  /** Instance du modal actif */
  _modal: null as Modal | null,

  /**
   * Ouvre le modal de paiement.
   *
   * @param config - Configuration du paiement (mode Direct ou Backend)
   * @throws {Error} Si la configuration est invalide
   *
   * @example Mode Backend
   * ```typescript
   * // Le backend a initialisé le paiement et retourne un paymentToken
   * CinetPaySeamless.open({
   *   paymentToken: 'abc123...',
   *   onResponse: (data) => {
   *     if (data.status === 'ACCEPTED') {
   *       console.log('Paiement réussi !')
   *     }
   *   },
   * })
   * ```
   *
   * @example Mode Direct
   * ```typescript
   * CinetPaySeamless.open({
   *   apiKey: 'sk_test_...',
   *   siteId: 123456,
   *   transactionId: `ORDER-${Date.now()}`,
   *   amount: 5000,
   *   currency: 'XOF',
   *   description: 'Achat en ligne',
   *   notifyUrl: 'https://monsite.com/webhook',
   *   channels: 'ALL',
   *   customerName: 'Jean Dupont',
   *   customerEmail: 'jean@email.com',
   *   customerPhoneNumber: '+2250707000000',
   *   onResponse: (data) => console.log(data),
   *   onError: (err) => console.error(err),
   * })
   * ```
   */
  async open(config: SeamlessConfig): Promise<void> {
    // Fermer un modal existant
    this.close()

    if (isBackendConfig(config)) {
      this.openWithToken(config)
    } else if (isDirectConfig(config)) {
      await this.openDirect(config)
    } else {
      throw new Error(
        'Invalid config: provide either "paymentToken" (backend mode) or "apiKey" + "siteId" (direct mode)',
      )
    }
  },

  /**
   * Ferme le modal de paiement s'il est ouvert.
   */
  close(): void {
    this._modal?.close()
    this._modal = null
  },

  /**
   * Mode Backend — ouvre le modal avec un paymentToken existant.
   */
  openWithToken(config: CommonConfig & BackendConfig): void {
    const paymentUrl = `${SECURE_BASE_URL}/checkout/${config.paymentToken}`

    this._modal = new Modal({
      theme: config.theme,
      closeAfterResponse: config.closeAfterResponse,
      onResponse: config.onResponse,
      onClose: config.onClose,
      onError: config.onError,
    })

    this._modal.open(paymentUrl)
  },

  /**
   * Mode Direct — initialise le paiement via l'API checkout puis ouvre le modal.
   */
  async openDirect(config: CommonConfig & DirectConfig): Promise<void> {
    const modal = new Modal({
      theme: config.theme,
      closeAfterResponse: config.closeAfterResponse,
      onResponse: config.onResponse,
      onClose: config.onClose,
      onError: config.onError,
    })

    try {
      const paymentUrl = await this.initializeCheckout(config)
      this._modal = modal
      modal.open(paymentUrl)
    } catch (error) {
      config.onError?.({
        code: 'INIT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to initialize payment',
      })
    }
  },

  /**
   * Appelle l'API checkout CinetPay pour initialiser le paiement en mode direct.
   * @internal
   */
  async initializeCheckout(config: DirectConfig): Promise<string> {
    const body: Record<string, unknown> = {
      apikey: config.apiKey,
      site_id: config.siteId,
      transaction_id: config.transactionId,
      amount: config.amount,
      currency: config.currency,
      description: config.description,
      notify_url: config.notifyUrl,
      channels: config.channels ?? 'ALL',
    }

    if (config.metadata) body.metadata = config.metadata
    if (config.customerName) body.customer_name = config.customerName
    if (config.customerSurname) body.customer_surname = config.customerSurname
    if (config.customerEmail) body.customer_email = config.customerEmail
    if (config.customerPhoneNumber) body.customer_phone_number = config.customerPhoneNumber
    if (config.customerAddress) body.customer_address = config.customerAddress
    if (config.customerCity) body.customer_city = config.customerCity
    if (config.customerCountry) body.customer_country = config.customerCountry
    if (config.customerZipCode) body.customer_zip_code = config.customerZipCode

    const response = await fetch(`${CHECKOUT_BASE_URL_SANDBOX}/v2/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json() as Record<string, unknown>

    if (data.code !== '201' && data.code !== 201) {
      throw new Error(
        (data.message as string) ?? (data.description as string) ?? `Checkout initialization failed (code: ${data.code})`,
      )
    }

    const paymentData = data.data as Record<string, unknown>
    const paymentUrl = paymentData?.payment_url as string

    if (!paymentUrl) {
      throw new Error('No payment_url returned from checkout API')
    }

    return paymentUrl
  },
}

// Auto-attach to window for CDN/script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).CinetPaySeamless = CinetPaySeamless
}

// Pas de default export — utiliser uniquement les named exports
