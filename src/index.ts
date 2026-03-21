import { Checkout } from './checkout'
import type {
  SeamlessConfig,
  PaymentResponse,
  PaymentError,
  PaymentStatus,
} from './types'
import { Logger } from './logger'
import { EventEmitter, type EventName, type EventMap } from './emitter'

export type {
  SeamlessConfig,
  PaymentResponse,
  PaymentError,
  PaymentStatus,
}
export type { EventName, EventMap } from './emitter'

/** @internal URL de base de la passerelle de paiement sécurisée */
const SECURE_BASE_URL = 'https://secure.cinetpay.net'

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
 * Ou avec des event listeners (style Stripe) :
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
   * Enregistre un listener d'événement (style Stripe).
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

    const paymentUrl = `${SECURE_BASE_URL}/checkout/${config.paymentToken}`

    this._checkout = new Checkout({
      logger,
      emitter: this._emitter,
      onReady: config.onReady,
      onPaymentSuccess: config.onPaymentSuccess,
      onPaymentFailed: config.onPaymentFailed,
      onPaymentPending: config.onPaymentPending,
      onClose: config.onClose,
      onError: config.onError,
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
