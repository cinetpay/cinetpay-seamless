import { Checkout } from './checkout'
import type {
  SeamlessConfig,
  PaymentResponse,
  PaymentError,
  PaymentStatus,
  StatusCheckContext,
  SeamlessEnvironment,
} from './types'
import { Logger } from './logger'
import { EventEmitter, type EventName, type EventMap } from './emitter'

export type {
  SeamlessConfig,
  PaymentResponse,
  PaymentError,
  PaymentStatus,
  StatusCheckContext,
  SeamlessEnvironment,
}
export type { EventName, EventMap } from './emitter'

/** @internal URLs de base de la passerelle de paiement sécurisée */
const SECURE_BASE_URLS: Record<SeamlessEnvironment, string> = {
  sandbox: 'https://secure.cinetpay.net',
  production: 'https://secure.cinetpay.co',
}

/** Récupère un callback en tolérant la casse pour les intégrations CDN/script tag. */
function getCallback<T extends Function>(config: SeamlessConfig, names: string[]): T | undefined {
  const record = config as unknown as Record<string, unknown>

  for (const name of names) {
    const value = record[name]
    if (typeof value === 'function') return value as T
  }

  const lowerNames = new Set(names.map((name) => name.toLowerCase()))
  for (const [key, value] of Object.entries(record)) {
    if (lowerNames.has(key.toLowerCase()) && typeof value === 'function') {
      return value as T
    }
  }

  return undefined
}

/** Récupère une option en tolérant la casse pour les intégrations CDN/script tag. */
function getOption<T>(config: SeamlessConfig, names: string[]): T | undefined {
  const record = config as unknown as Record<string, unknown>

  for (const name of names) {
    if (record[name] !== undefined) return record[name] as T
  }

  const lowerNames = new Set(names.map((name) => name.toLowerCase()))
  for (const [key, value] of Object.entries(record)) {
    if (lowerNames.has(key.toLowerCase())) return value as T
  }

  return undefined
}

function createStatusChecker(config: SeamlessConfig): (() => Promise<unknown>) | undefined {
  const context: StatusCheckContext = { paymentToken: config.paymentToken }
  const checkStatus = getCallback<(context: StatusCheckContext) => Promise<unknown>>(config, [
    'checkStatus',
    'checkPaymentStatus',
    'checkTransactionStatus',
  ])

  if (checkStatus) {
    return () => checkStatus(context)
  }

  const statusUrl = getOption<SeamlessConfig['statusUrl']>(config, ['statusUrl', 'statusURL'])
  if (!statusUrl) return undefined

  return async () => {
    const url = typeof statusUrl === 'function' ? statusUrl(context) : statusUrl
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Status check failed with HTTP ${response.status}`)
    }

    return response.json()
  }
}

function createPaymentUrl(config: SeamlessConfig): string {
  const explicitUrl = getOption<string>(config, ['paymentUrl', 'checkoutUrl'])
  if (explicitUrl) return explicitUrl

  const environment = getOption<SeamlessEnvironment>(config, ['environment', 'env']) ?? 'sandbox'
  const checkoutBaseUrl =
    getOption<string>(config, ['checkoutBaseUrl', 'secureBaseUrl']) ??
    SECURE_BASE_URLS[environment] ??
    SECURE_BASE_URLS.sandbox

  return `${checkoutBaseUrl.replace(/\/+$/, '')}/checkout/${config.paymentToken}`
}

/**
 * CinetPay Seamless — paiement inline via popup window.
 *
 * Affiche un overlay d'attente et ouvre la passerelle de paiement
 * CinetPay dans une popup. Le client reste sur votre page.
 *
 * Le `paymentToken` est obtenu côté serveur via l'API CinetPay :
 *
 * ```typescript
 * // Frontend
 * CinetPaySeamless.open({
 *   paymentToken: 'abc123...',
 *   onPaymentSuccess: (data) => console.log('Payé !', data.amount),
 * })
 * ```
 *
 * Ou avec des event listeners (style événementiel) :
 *
 * ```typescript
 * CinetPaySeamless.on('payment.success', (data) => { ... })
 * CinetPaySeamless.open({ paymentToken: 'abc123...' })
 * ```
 */
export const CinetPaySeamless = {
  /** Instance du checkout actuellement ouvert */
  _checkout: null as Checkout | null,

  /** Event emitter partagé */
  _emitter: new EventEmitter(),

  /**
   * Enregistre un listener d'événement (style événementiel).
   *
   * @param event - Nom de l'événement
   * @param handler - Fonction appelée quand l'événement est émis
   * @returns Fonction de désabonnement
   *
   * @example
   * ```typescript
   * const unsub = CinetPaySeamless.on('payment.success', (data) => {
   *   console.log('Payé !', data.amount, data.currency)
   * })
   * unsub() // Se désabonner
   * ```
   */
  on<E extends EventName>(
    event: E,
    handler: EventMap[E] extends void ? () => void : (data: EventMap[E]) => void,
  ): () => void {
    return this._emitter.on(event, handler)
  },

  /**
   * Supprime un listener.
   */
  off<E extends EventName>(
    event: E,
    handler: EventMap[E] extends void ? () => void : (data: EventMap[E]) => void,
  ): void {
    this._emitter.off(event, handler)
  },

  /**
   * Enregistre un listener appelé une seule fois.
   */
  once<E extends EventName>(
    event: E,
    handler: EventMap[E] extends void ? () => void : (data: EventMap[E]) => void,
  ): void {
    this._emitter.once(event, handler)
  },

  /**
   * Ouvre le checkout CinetPay.
   *
   * Affiche un overlay d'attente et ouvre la page de paiement dans une popup.
   * La popup est centrée sur l'écran (500x700px).
   *
   * @param config - Configuration avec `paymentToken` et callbacks optionnels
   * @throws {Error} Si le `paymentToken` a un format invalide
   *
   * @example
   * ```typescript
   * CinetPaySeamless.open({
   *   paymentToken: 'abc123def456...',
   *   debug: true,
   *   onPaymentSuccess: (data) => console.log('Payé !', data.amount),
   *   onPaymentFailed: (data) => console.log('Refusé'),
   *   onClose: ({ status }) => console.log('Fermé:', status),
   * })
   * ```
   */
  open(config: SeamlessConfig): void {
    this.close()

    const logger = new Logger(config.debug ?? false)
    logger.debug('CinetPaySeamless.open() called')

    // Validation du paymentToken
    if (!/^[a-zA-Z0-9_-]{10,128}$/.test(config.paymentToken)) {
      throw new Error('Invalid paymentToken format — expected alphanumeric string (10-128 chars)')
    }

    const paymentUrl = createPaymentUrl(config)

    this._checkout = new Checkout({
      logger,
      emitter: this._emitter,
      statusChecker: createStatusChecker(config),
      statusPollInterval: getOption<number>(config, ['statusPollInterval', 'statusCheckInterval']),
      onReady: getCallback(config, ['onReady']),
      onPaymentSuccess: getCallback(config, [
        'onPaymentSuccess',
        'onSuccess',
        'onPaymentsuccess',
        'onpaymentSuccess',
        'onpaymentsuccess',
      ]),
      onPaymentFailed: getCallback(config, [
        'onPaymentFailed',
        'onPaymentFail',
        'onPaymentFailure',
        'onFailed',
        'onPaymentfailed',
        'onpaymentFailed',
        'onpaymentfailed',
      ]),
      onPaymentPending: getCallback(config, ['onPaymentPending', 'onPending']),
      onClose: getCallback(config, ['onClose']),
      onError: getCallback(config, ['onError']),
    })

    this._checkout.open(paymentUrl)
  },

  /**
   * Ferme le checkout (popup + overlay).
   */
  close(): void {
    this._checkout?.close()
    this._checkout = null
  },
}

// Auto-attach to window for CDN/script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).CinetPaySeamless = CinetPaySeamless
}
