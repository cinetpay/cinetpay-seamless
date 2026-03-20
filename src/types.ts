/** Configuration du mode Direct (sans backend) */
export interface DirectConfig {
  /** Clé API CinetPay (sk_test_... ou sk_live_...) */
  apiKey: string
  /** Identifiant du site/service CinetPay */
  siteId: number
  /** Identifiant unique de la transaction */
  transactionId: string
  /** Montant du paiement (entier, min: 100) */
  amount: number
  /** Devise : XOF, XAF, GNF, CDF ou USD */
  currency: string
  /** Description du paiement */
  description: string
  /** URL de notification webhook */
  notifyUrl: string
  /** Canaux de paiement : ALL, MOBILE_MONEY, CREDIT_CARD, WALLET */
  channels?: string
  /** Métadonnées personnalisées (récupérées dans le webhook) */
  metadata?: string
  /** Nom du client */
  customerName?: string
  /** Prénom du client */
  customerSurname?: string
  /** Email du client */
  customerEmail?: string
  /** Numéro de téléphone du client */
  customerPhoneNumber?: string
  /** Adresse du client */
  customerAddress?: string
  /** Ville du client */
  customerCity?: string
  /** Pays du client (code ISO) */
  customerCountry?: string
  /** Code postal (cartes bancaires) */
  customerZipCode?: string
}

/** Configuration du mode Backend (avec paymentToken) */
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
  return 'apiKey' in config
}

/** Vérifie si la config est en mode Backend */
export function isBackendConfig(config: SeamlessConfig): config is CommonConfig & BackendConfig {
  return 'paymentToken' in config
}
