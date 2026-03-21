import type { PaymentResponse, PaymentError } from './types'

/**
 * Map des événements émis par le SDK Seamless.
 *
 * | Événement | Donnée | Quand |
 * |---|---|---|
 * | `ready` | — | Popup ouverte, passerelle prête |
 * | `payment.success` | `PaymentResponse` | Paiement accepté |
 * | `payment.failed` | `PaymentResponse` | Paiement refusé |
 * | `payment.pending` | `PaymentResponse` | En attente (PENDING, INITIATED, EXPIRED) |
 * | `close` | `{ status: string }` | Popup fermée, overlay retiré |
 * | `error` | `PaymentError` | Erreur technique |
 */
export interface EventMap {
  'ready': void
  'payment.success': PaymentResponse
  'payment.failed': PaymentResponse
  'payment.pending': PaymentResponse
  'close': { status: string }
  'error': PaymentError
}

/** Type des noms d'événements */
export type EventName = keyof EventMap

/** Type d'un handler pour un événement donné */
type Handler<T> = T extends void ? () => void : (data: T) => void

/**
 * Event emitter typé pour le SDK Seamless.
 *
 * Permet d'écouter les événements de paiement avec `on()` et `off()`,
 * style événementiel (`on('event', handler)`).
 *
 * @example
 * ```typescript
 * CinetPaySeamless.on('payment.success', (data) => {
 *   console.log('Payé !', data.amount, data.currency)
 * })
 *
 * CinetPaySeamless.on('payment.failed', (data) => {
 *   console.log('Refusé', data.transactionId)
 * })
 *
 * CinetPaySeamless.on('ready', () => {
 *   console.log('Passerelle chargée')
 * })
 * ```
 */
export class EventEmitter {
  private listeners = new Map<string, Set<Function>>()

  /**
   * Enregistre un handler pour un événement.
   *
   * @param event - Nom de l'événement
   * @param handler - Fonction appelée quand l'événement est émis
   * @returns Fonction pour se désabonner (équivalent de `off(event, handler)`)
   *
   * @example
   * ```typescript
   * const unsubscribe = CinetPaySeamless.on('payment.success', (data) => { ... })
   * // Plus tard :
   * unsubscribe()
   * ```
   */
  on<E extends EventName>(event: E, handler: Handler<EventMap[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)

    // Retourne une fonction de désabonnement
    return () => this.off(event, handler)
  }

  /**
   * Supprime un handler pour un événement.
   *
   * @param event - Nom de l'événement
   * @param handler - Référence du handler à supprimer
   */
  off<E extends EventName>(event: E, handler: Handler<EventMap[E]>): void {
    this.listeners.get(event)?.delete(handler)
  }

  /**
   * Enregistre un handler qui ne sera appelé qu'une seule fois.
   *
   * @param event - Nom de l'événement
   * @param handler - Fonction appelée une seule fois
   *
   * @example
   * ```typescript
   * CinetPaySeamless.once('payment.success', (data) => {
   *   // Appelé une seule fois
   * })
   * ```
   */
  once<E extends EventName>(event: E, handler: Handler<EventMap[E]>): void {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as Handler<EventMap[E]>)
      ;(handler as Function)(...args)
    }) as Handler<EventMap[E]>
    this.on(event, wrapper)
  }

  /**
   * Émet un événement — appelle tous les handlers enregistrés.
   * @internal
   */
  emit<E extends EventName>(event: E, ...args: EventMap[E] extends void ? [] : [EventMap[E]]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        (handler as Function)(...args)
      } catch {
        // Ne pas bloquer les autres handlers si un throw
      }
    }
  }

  /**
   * Supprime tous les handlers pour tous les événements.
   * @internal
   */
  removeAll(): void {
    this.listeners.clear()
  }
}
