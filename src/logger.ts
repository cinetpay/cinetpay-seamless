/** Préfixe des messages de log */
const PREFIX = '[CinetPay Seamless]'

/**
 * Logger interne du SDK Seamless.
 * Désactivé par défaut. Activable via `debug: true` dans la config.
 *
 * Tous les logs utilisent le préfixe `[CinetPay Seamless]` pour être
 * facilement filtrables dans la console du navigateur.
 */
export class Logger {
  private enabled: boolean

  constructor(enabled: boolean) {
    this.enabled = enabled
  }

  /** Log de debug — requêtes, réponses, événements */
  debug(message: string, data?: unknown): void {
    if (!this.enabled) return
    if (data !== undefined) {
      console.debug(`${PREFIX} ${message}`, data)
    } else {
      console.debug(`${PREFIX} ${message}`)
    }
  }

  /** Log d'avertissement — credentials exposés, statuts inattendus */
  warn(message: string, data?: unknown): void {
    if (!this.enabled) return
    if (data !== undefined) {
      console.warn(`${PREFIX} ${message}`, data)
    } else {
      console.warn(`${PREFIX} ${message}`)
    }
  }

  /** Log d'erreur — erreurs API, timeouts, postMessage invalides */
  error(message: string, data?: unknown): void {
    if (!this.enabled) return
    if (data !== undefined) {
      console.error(`${PREFIX} ${message}`, data)
    } else {
      console.error(`${PREFIX} ${message}`)
    }
  }
}
