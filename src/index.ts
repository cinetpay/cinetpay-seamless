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

const API_BASE_URL_SANDBOX = 'https://api.cinetpay.net'
const API_BASE_URL_PROD = 'https://api.cinetpay.co'
const API_KEY_PREFIX_TEST = 'sk_test_'
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
 * **Mode Direct** — le frontend s'authentifie et initialise le paiement :
 * ```typescript
 * CinetPaySeamless.open({
 *   apiKey: 'sk_test_...',
 *   apiPassword: 'your_password',
 *   country: 'CI',
 *   merchantTransactionId: 'ORDER-001',
 *   amount: 1000,
 *   currency: 'XOF',
 *   designation: 'Achat',
 *   clientEmail: 'jean@email.com',
 *   clientFirstName: 'Jean',
 *   clientLastName: 'Dupont',
 *   notifyUrl: 'https://monsite.com/webhook',
 *   successUrl: 'https://monsite.com/success',
 *   failedUrl: 'https://monsite.com/failed',
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
   */
  async open(config: SeamlessConfig): Promise<void> {
    this.close()

    if (isBackendConfig(config)) {
      this.openWithToken(config)
    } else if (isDirectConfig(config)) {
      await this.openDirect(config)
    } else {
      throw new Error(
        'Invalid config: provide either "paymentToken" (backend mode) or "apiKey" + "apiPassword" (direct mode)',
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
   * Mode Direct — authentification JWT puis initialisation du paiement.
   * Flow : POST /v1/oauth/login → POST /v1/payment → ouvre le modal avec paymentUrl.
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
      const baseUrl = this.resolveBaseUrl(config.apiKey)

      // 1. Authentification JWT
      const token = await this.authenticate(baseUrl, config.apiKey, config.apiPassword)

      // 2. Initialisation du paiement
      const paymentUrl = await this.initializePayment(baseUrl, token, config)

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
   * Détermine l'URL de base à partir du préfixe de la clé API.
   * @internal
   */
  resolveBaseUrl(apiKey: string): string {
    return apiKey.startsWith(API_KEY_PREFIX_TEST) ? API_BASE_URL_SANDBOX : API_BASE_URL_PROD
  },

  /**
   * Authentification JWT via POST /v1/oauth/login.
   * @internal
   */
  async authenticate(baseUrl: string, apiKey: string, apiPassword: string): Promise<string> {
    const response = await fetch(`${baseUrl}/v1/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        api_password: apiPassword,
      }),
    })

    const data = await response.json() as Record<string, unknown>

    if (data.code !== 200 || !data.access_token) {
      throw new Error(
        (data.description as string) ?? 'Authentication failed — check your apiKey and apiPassword',
      )
    }

    return data.access_token as string
  },

  /**
   * Initialisation du paiement via POST /v1/payment.
   * @internal
   */
  async initializePayment(baseUrl: string, token: string, config: DirectConfig): Promise<string> {
    const body: Record<string, unknown> = {
      currency: config.currency,
      merchant_transaction_id: config.merchantTransactionId,
      amount: config.amount,
      lang: config.channel ?? 'fr',
      designation: config.designation,
      client_email: config.clientEmail,
      client_first_name: config.clientFirstName,
      client_last_name: config.clientLastName,
      success_url: config.successUrl,
      failed_url: config.failedUrl,
      notify_url: config.notifyUrl,
      channel: config.channel ?? 'PUSH',
    }

    if (config.paymentMethod) body.payment_method = config.paymentMethod
    if (config.clientPhoneNumber) body.client_phone_number = config.clientPhoneNumber

    const response = await fetch(`${baseUrl}/v1/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as Record<string, unknown>

    if (!data.payment_url && !data.payment_token) {
      throw new Error(
        (data.description as string) ?? (data.status as string) ?? 'Payment initialization failed',
      )
    }

    // Si payment_url est retourné directement, l'utiliser
    if (data.payment_url) {
      return data.payment_url as string
    }

    // Sinon construire l'URL depuis le payment_token
    return `${SECURE_BASE_URL}/checkout/${data.payment_token as string}`
  },
}

// Auto-attach to window for CDN/script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).CinetPaySeamless = CinetPaySeamless
}
