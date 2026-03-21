import { Modal } from './modal'
import type {
  SeamlessConfig,
  PaymentResponse,
  PaymentError,
  PaymentStatus,
} from './types'
import { Logger } from './logger'
import { EventEmitter, type EventName, type EventMap } from './emitter'

// Re-export types
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
 * CinetPay Seamless — paiement inline sans redirection.
 *
 * Affiche un modal contenant la passerelle de paiement CinetPay
 * directement dans votre page. Le client ne quitte jamais votre site.
 *
 * Le `paymentToken` est obtenu côté serveur via le SDK `cinetpay-js` :
 *
 * ```typescript
 * // Backend (Node.js / Express / Next.js)
 * const payment = await client.payment.initialize({ ... }, 'CI')
 * res.json({ paymentToken: payment.paymentToken })
 * ```
 *
 * ```typescript
 * // Frontend
 * import { CinetPaySeamless } from 'cinetpay-seamless'
 *
 * CinetPaySeamless.open({
 *   paymentToken: 'abc123...',
 *   onPaymentSuccess: (data) => console.log('Payé !', data.amount),
 *   onPaymentFailed: (data) => console.log('Refusé'),
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
  /** Instance du modal actuellement ouvert */
  _modal: null as Modal | null,

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
   *
   * // Plus tard :
   * unsub()
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
   *
   * @param event - Nom de l'événement
   * @param handler - Référence du handler à supprimer
   */
  off<E extends EventName>(
    event: E,
    handler: EventMap[E] extends void ? () => void : (data: EventMap[E]) => void,
  ): void {
    this._emitter.off(event, handler)
  },

  /**
   * Enregistre un listener appelé une seule fois.
   *
   * @param event - Nom de l'événement
   * @param handler - Fonction appelée une seule fois
   */
  once<E extends EventName>(
    event: E,
    handler: EventMap[E] extends void ? () => void : (data: EventMap[E]) => void,
  ): void {
    this._emitter.once(event, handler)
  },

  /**
   * Ouvre le modal de paiement CinetPay.
   *
   * @param config - Configuration avec `paymentToken` et callbacks optionnels
   * @throws {Error} Si le `paymentToken` a un format invalide
   *
   * @example
   * ```typescript
   * CinetPaySeamless.open({
   *   paymentToken: 'abc123def456...',
   *   theme: 'dark',
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
    logger.debug('Opening modal', { paymentUrl })

    this._modal = new Modal({
      theme: config.theme,
      closeAfterResponse: config.closeAfterResponse,
      logger,
      emitter: this._emitter,
      onReady: config.onReady,
      onPaymentSuccess: config.onPaymentSuccess,
      onPaymentFailed: config.onPaymentFailed,
      onPaymentPending: config.onPaymentPending,
      onClose: config.onClose,
      onError: config.onError,
    })

    this._modal.open(paymentUrl)
  },

  /**
   * Ferme le modal de paiement s'il est ouvert.
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
}

// Auto-attach to window for CDN/script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).CinetPaySeamless = CinetPaySeamless
}
