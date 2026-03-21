/**
 * Configuration du SDK CinetPay Seamless.
 *
 * Le `paymentToken` est obtenu côté serveur via le SDK `cinetpay-js` :
 * ```typescript
 * // Backend (Node.js)
 * const payment = await client.payment.initialize({ ... }, 'CI')
 * // Retourner payment.paymentToken au frontend
 * ```
 *
 * @example
 * ```typescript
 * CinetPaySeamless.open({
 *   paymentToken: 'abc123...',
 *   onPaymentSuccess: (data) => console.log('Payé !'),
 * })
 * ```
 */
export interface SeamlessConfig {
  /** Token de paiement obtenu via le SDK backend `cinetpay-js` */
  paymentToken: string
  /** Langue de l'interface : fr ou en */
  lang?: 'fr' | 'en'
  /** Afficher l'écran de résultat après le paiement (défaut: true) */
  closeAfterResponse?: boolean
  /** Thème du modal : `'light'` (défaut) ou `'dark'` */
  theme?: 'light' | 'dark'
  /** Callback : iframe chargée, passerelle visible */
  onReady?: () => void
  /** Callback : paiement accepté (statut ACCEPTED) */
  onPaymentSuccess?: (data: PaymentResponse) => void
  /** Callback : paiement refusé (statut REFUSED) */
  onPaymentFailed?: (data: PaymentResponse) => void
  /** Callback : paiement en attente (statut PENDING, INITIATED, EXPIRED) */
  onPaymentPending?: (data: PaymentResponse) => void
  /** Callback : modal fermé */
  onClose?: (data: { status: string }) => void
  /** Callback : erreur technique */
  onError?: (error: PaymentError) => void
  /**
   * Taille de la popup de paiement.
   * - `sm` : 400x500
   * - `md` : 500x650 (défaut)
   * - `lg` : 600x750
   * - `xl` : 800x900
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Active les logs de debug dans la console avec le préfixe `[CinetPay Seamless]`.
   * @default false
   */
  debug?: boolean
}

/** Statuts possibles d'un paiement */
export type PaymentStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'INITIATED' | 'EXPIRED' | 'UNKNOWN'

/** Réponse de paiement retournée dans les callbacks */
export interface PaymentResponse {
  /** Montant payé */
  amount: number
  /** Devise */
  currency: string
  /** Statut du paiement */
  status: PaymentStatus
  /** Code de l'opérateur (OM, MOMO, etc.) */
  paymentMethod: string
  /** Description du service */
  description: string
  /** Métadonnées personnalisées */
  metadata?: string
  /** ID de transaction de l'opérateur */
  operatorId?: string
  /** Date du paiement */
  paymentDate?: string
  /** ID de la transaction */
  transactionId: string
}

/** Erreur de paiement */
export interface PaymentError {
  /** Code d'erreur */
  code: string
  /** Message d'erreur */
  message: string
}
