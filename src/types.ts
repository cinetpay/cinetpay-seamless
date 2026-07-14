/**
 * Configuration du SDK CinetPay Seamless.
 *
 * Le `paymentToken` est obtenu côté serveur en appelant l'API CinetPay
 * `POST /v1/payment`. Utilisez le SDK de votre choix (cinetpay-js, cinetpay-laravel-sdk,
 * ou un appel API direct) pour initialiser le paiement et récupérer le token.
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
  /** Token de paiement obtenu côté serveur via l'API CinetPay `POST /v1/payment` */
  paymentToken: string
  /** Langue de l'interface : fr ou en */
  lang?: 'fr' | 'en'
  /** Callback : popup ouverte, passerelle de paiement prête */
  onReady?: () => void
  /** Callback : paiement accepté (statut ACCEPTED) */
  onPaymentSuccess?: (data: PaymentResponse) => void
  /**
   * @deprecated Utilisez `onPaymentSuccess`. Conservé pour les intégrations vanilla JS
   * qui ont utilisé une casse incorrecte.
   */
  onPaymentsuccess?: (data: PaymentResponse) => void
  /**
   * @deprecated Utilisez `onPaymentSuccess`. Conservé pour les intégrations vanilla JS
   * qui ont utilisé une casse incorrecte.
   */
  onpaymentSuccess?: (data: PaymentResponse) => void
  /**
   * @deprecated Utilisez `onPaymentSuccess`. Conservé pour les intégrations vanilla JS
   * qui ont utilisé une casse incorrecte.
   */
  onpaymentsuccess?: (data: PaymentResponse) => void
  /** Callback : paiement refusé (statut REFUSED) */
  onPaymentFailed?: (data: PaymentResponse) => void
  /**
   * @deprecated Utilisez `onPaymentFailed`. Conservé pour les intégrations vanilla JS
   * qui ont utilisé une casse incorrecte.
   */
  onPaymentfailed?: (data: PaymentResponse) => void
  /**
   * @deprecated Utilisez `onPaymentFailed`. Conservé pour les intégrations vanilla JS
   * qui ont utilisé une casse incorrecte.
   */
  onpaymentFailed?: (data: PaymentResponse) => void
  /**
   * @deprecated Utilisez `onPaymentFailed`. Conservé pour les intégrations vanilla JS
   * qui ont utilisé une casse incorrecte.
   */
  onpaymentfailed?: (data: PaymentResponse) => void
  /** Callback : paiement en attente (statut PENDING, INITIATED, EXPIRED) */
  onPaymentPending?: (data: PaymentResponse) => void
  /** Callback : popup fermée et overlay retiré */
  onClose?: (data: { status: string }) => void
  /** Callback : erreur technique */
  onError?: (error: PaymentError) => void
  /**
   * Active les logs de debug dans la console avec le préfixe `[CinetPay Seamless]`.
   * @default false
   */
  debug?: boolean
}

/** Statuts possibles d'un paiement */
export type PaymentStatus =
  | 'ACCEPTED'
  | 'REFUSED'
  | 'PENDING'
  | 'INITIATED'
  | 'EXPIRED'
  | 'UNKNOWN'

/** Réponse de paiement retournée dans les callbacks */
export interface PaymentResponse {
  /** Montant payé */
  amount: number
  /** Devise */
  currency: string
  /** Statut du paiement */
  status: PaymentStatus
  /** Statut brut reçu de CinetPay, utile si le statut a été normalisé */
  rawStatus?: string
  /** Code API CinetPay, si présent */
  apiCode?: number
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
