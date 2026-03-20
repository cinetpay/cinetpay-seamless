/** Configuration du mode Direct (sans backend) — utilise api_key + api_password pour l'auth JWT */
export interface DirectConfig {
  /** Clé API CinetPay (sk_test_... ou sk_live_...) */
  apiKey: string
  /** Mot de passe API CinetPay */
  apiPassword: string
  /** Code pays ISO (ex: CI, SN, CM) — détermine les credentials et l'environnement */
  country: string
  /** Identifiant unique de la transaction côté marchand (max 30 caractères) */
  merchantTransactionId: string
  /** Montant du paiement (entier, min: 100, max: 2 500 000) */
  amount: number
  /** Devise : XOF, XAF, GNF, CDF ou USD */
  currency: string
  /** Libellé du paiement affiché au client */
  designation: string
  /** URL de notification webhook pour le statut final */
  notifyUrl: string
  /** URL de redirection après un paiement réussi */
  successUrl: string
  /** URL de redirection après un paiement échoué */
  failedUrl: string
  /** Canal de paiement : PUSH, OTP ou QRCODE */
  channel?: string
  /** Méthode de paiement spécifique (ex: OM_CI, WAVE_SN). Si omis, toutes les méthodes du pays sont proposées. */
  paymentMethod?: string
  /** Email du client */
  clientEmail: string
  /** Prénom du client (2-255 caractères) */
  clientFirstName: string
  /** Nom du client (2-255 caractères) */
  clientLastName: string
  /** Numéro de téléphone du client au format international */
  clientPhoneNumber?: string
}

/** Configuration du mode Backend (avec paymentToken obtenu via cinetpay-js) */
export interface BackendConfig {
  /** Token de paiement obtenu via le SDK backend cinetpay-js */
  paymentToken: string
}

/** Configuration commune aux deux modes */
export interface CommonConfig {
  /** Langue de l'interface : fr ou en */
  lang?: 'fr' | 'en'
  /** Fermer automatiquement le modal après la réponse */
  closeAfterResponse?: boolean
  /** Thème du modal */
  theme?: 'light' | 'dark'
  /** Callback appelé quand le paiement est terminé (succès ou échec) */
  onResponse?: (data: PaymentResponse) => void
  /** Callback appelé quand le modal est fermé */
  onClose?: (data: { status: string }) => void
  /** Callback appelé en cas d'erreur */
  onError?: (error: PaymentError) => void
}

/** Configuration complète — mode Direct OU Backend */
export type SeamlessConfig = CommonConfig & (DirectConfig | BackendConfig)

/** Réponse de paiement retournée dans onResponse */
export interface PaymentResponse {
  /** Montant payé */
  amount: number
  /** Devise */
  currency: string
  /** Statut : ACCEPTED ou REFUSED */
  status: 'ACCEPTED' | 'REFUSED'
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

/** Vérifie si la config est en mode Direct */
export function isDirectConfig(config: SeamlessConfig): config is CommonConfig & DirectConfig {
  return 'apiKey' in config && 'apiPassword' in config
}

/** Vérifie si la config est en mode Backend */
export function isBackendConfig(config: SeamlessConfig): config is CommonConfig & BackendConfig {
  return 'paymentToken' in config
}
