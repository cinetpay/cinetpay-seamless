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

/** @internal URL de l'API CinetPay en sandbox */
const API_BASE_URL_SANDBOX = 'https://api.cinetpay.net'
/** @internal URL de l'API CinetPay en production */
const API_BASE_URL_PROD = 'https://api.cinetpay.co'
/** @internal Préfixe des clés API sandbox */
const API_KEY_PREFIX_TEST = 'sk_test_'
/** @internal URL de base de la passerelle de paiement sécurisée */
const SECURE_BASE_URL = 'https://secure.cinetpay.net'
/** @internal Timeout par défaut des requêtes HTTP en millisecondes */
const REQUEST_TIMEOUT = 30_000

/**
 * CinetPay Seamless — intégration de paiement inline sans redirection.
 *
 * Affiche un modal contenant la passerelle de paiement CinetPay
 * directement dans votre page. Le client ne quitte jamais votre site.
 *
 * Deux modes d'utilisation :
 *
 * **Mode Backend** (recommandé) — le serveur initialise le paiement
 * via le SDK `cinetpay-js` et passe le `paymentToken` au frontend :
 * ```typescript
 * CinetPaySeamless.open({
 *   paymentToken: 'token-du-backend',
 *   onResponse: (data) => console.log(data.status),
 * })
 * ```
 *
 * **Mode Direct** — le frontend s'authentifie (JWT) et initialise le
 * paiement directement. Les credentials sont exposés côté client :
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
  /** Instance du modal de paiement actuellement ouvert (`null` si fermé) */
  _modal: null as Modal | null,

  /**
   * Ouvre le modal de paiement CinetPay.
   *
   * Détecte automatiquement le mode (Backend ou Direct) à partir
   * des propriétés fournies dans la configuration.
   *
   * @param config - Configuration du paiement
   * @throws {Error} Si la configuration est invalide (ni `paymentToken` ni `apiKey`+`apiPassword`)
   * @throws {Error} Si le `paymentToken` a un format invalide (mode Backend)
   *
   * @example Mode Backend
   * ```typescript
   * CinetPaySeamless.open({
   *   paymentToken: 'abc123def456...',
   *   theme: 'dark',
   *   onResponse: (data) => {
   *     if (data.status === 'ACCEPTED') console.log('Payé !')
   *   },
   *   onClose: ({ status }) => console.log('Fermé:', status),
   * })
   * ```
   *
   * @example Mode Direct
   * ```typescript
   * CinetPaySeamless.open({
   *   apiKey: 'sk_test_...',
   *   apiPassword: 'password',
   *   country: 'CI',
   *   merchantTransactionId: 'ORDER-001',
   *   amount: 5000,
   *   currency: 'XOF',
   *   designation: 'Commande',
   *   clientEmail: 'client@email.com',
   *   clientFirstName: 'Jean',
   *   clientLastName: 'Dupont',
   *   notifyUrl: 'https://monsite.com/webhook',
   *   successUrl: 'https://monsite.com/success',
   *   failedUrl: 'https://monsite.com/failed',
   *   onResponse: (data) => console.log(data),
   *   onError: (err) => console.error(err),
   * })
   * ```
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
   * Sans effet si aucun modal n'est actif.
   *
   * @example
   * ```typescript
   * CinetPaySeamless.close()
   * ```
   */
  close(): void {
    this._modal?.close()
    this._modal = null
  },

  /**
   * Mode Backend — ouvre le modal avec un `paymentToken` obtenu
   * via le SDK backend `cinetpay-js`.
   *
   * Le token est validé (format alphanumérique, 10-128 caractères)
   * pour empêcher les injections d'URL.
   *
   * @param config - Configuration avec `paymentToken` et callbacks
   * @throws {Error} Si le format du `paymentToken` est invalide
   */
  openWithToken(config: CommonConfig & BackendConfig): void {
    if (!/^[a-zA-Z0-9_-]{10,128}$/.test(config.paymentToken)) {
      throw new Error('Invalid paymentToken format — expected alphanumeric string (10-128 chars)')
    }

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
   *
   * Flow complet :
   * 1. `POST /v1/oauth/login` → obtient un token JWT
   * 2. `POST /v1/payment` (avec Bearer token) → obtient le `paymentUrl`
   * 3. Ouvre le modal avec l'URL de la passerelle
   *
   * Émet un warning en console si utilisé hors localhost (credentials exposés).
   *
   * @param config - Configuration avec `apiKey`, `apiPassword`, données du paiement et callbacks
   */
  async openDirect(config: CommonConfig & DirectConfig): Promise<void> {
    const modal = new Modal({
      theme: config.theme,
      closeAfterResponse: config.closeAfterResponse,
      onResponse: config.onResponse,
      onClose: config.onClose,
      onError: config.onError,
    })

    if (typeof window !== 'undefined' && !window.location.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
      console.warn(
        '[CinetPay Seamless] WARNING: Mode Direct expose vos credentials (apiKey + apiPassword) ' +
        'dans le code frontend. Utilisez le mode Backend (paymentToken) en production.',
      )
    }

    try {
      const baseUrl = this.resolveBaseUrl(config.apiKey)
      const token = await this.authenticate(baseUrl, config.apiKey, config.apiPassword)
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
   * Détermine l'URL de base de l'API à partir du préfixe de la clé API.
   * - `sk_test_...` → `https://api.cinetpay.net` (sandbox)
   * - `sk_live_...` → `https://api.cinetpay.co` (production)
   *
   * @param apiKey - Clé API CinetPay
   * @returns URL de base de l'API
   * @internal
   */
  resolveBaseUrl(apiKey: string): string {
    return apiKey.startsWith(API_KEY_PREFIX_TEST) ? API_BASE_URL_SANDBOX : API_BASE_URL_PROD
  },

  /**
   * Authentification JWT via `POST /v1/oauth/login`.
   *
   * @param baseUrl - URL de base de l'API (sandbox ou production)
   * @param apiKey - Clé API CinetPay
   * @param apiPassword - Mot de passe API CinetPay
   * @returns Token JWT Bearer
   * @throws {Error} Si l'authentification échoue ou timeout (30s)
   * @internal
   */
  async authenticate(baseUrl: string, apiKey: string, apiPassword: string): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    let response: Response
    try {
      response = await fetch(`${baseUrl}/v1/oauth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          api_password: apiPassword,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Authentication request timed out')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }

    const data = await response.json() as Record<string, unknown>

    if (data.code !== 200 || !data.access_token) {
      throw new Error(
        (data.description as string) ?? 'Authentication failed — check your apiKey and apiPassword',
      )
    }

    return data.access_token as string
  },

  /**
   * Initialisation du paiement via `POST /v1/payment`.
   *
   * Envoie les données de paiement avec `direct_pay: false` (le paiement
   * est effectué via l'iframe, pas en programmatique).
   *
   * @param baseUrl - URL de base de l'API
   * @param token - Token JWT obtenu via {@link authenticate}
   * @param config - Données du paiement (montant, devise, client, URLs, etc.)
   * @returns URL de la passerelle de paiement à charger dans l'iframe
   * @throws {Error} Si l'initialisation échoue ou timeout (30s)
   * @internal
   */
  async initializePayment(baseUrl: string, token: string, config: DirectConfig): Promise<string> {
    const body: Record<string, unknown> = {
      currency: config.currency,
      merchant_transaction_id: config.merchantTransactionId,
      amount: config.amount,
      lang: 'fr',
      designation: config.designation,
      client_email: config.clientEmail,
      client_first_name: config.clientFirstName,
      client_last_name: config.clientLastName,
      success_url: config.successUrl,
      failed_url: config.failedUrl,
      notify_url: config.notifyUrl,
      channel: config.channel ?? 'PUSH',
      direct_pay: false,
    }

    if (config.paymentMethod) body.payment_method = config.paymentMethod
    if (config.clientPhoneNumber) body.client_phone_number = config.clientPhoneNumber

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    let response: Response
    try {
      response = await fetch(`${baseUrl}/v1/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Payment initialization request timed out')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }

    const data = await response.json() as Record<string, unknown>

    if (!data.payment_url && !data.payment_token) {
      throw new Error(
        (data.description as string) ?? (data.status as string) ?? 'Payment initialization failed',
      )
    }

    if (data.payment_url) {
      return data.payment_url as string
    }

    return `${SECURE_BASE_URL}/checkout/${data.payment_token as string}`
  },
}

// Auto-attach to window for CDN/script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).CinetPaySeamless = CinetPaySeamless
}
