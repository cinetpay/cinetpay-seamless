/**
 * Styles CSS du modal CinetPay Seamless.
 *
 * Injectés dynamiquement dans le `<head>` via un élément `<style>`
 * avec l'ID `cp-seamless-styles`. Ne sont injectés qu'une seule fois,
 * même si plusieurs modals sont ouverts successivement.
 *
 * Structure CSS :
 * - `.cp-seamless-overlay` — fond semi-transparent plein écran
 * - `.cp-seamless-modal` — conteneur principal (max 420px, centré)
 * - `.cp-seamless-header` — logo CinetPay + bouton fermer
 * - `.cp-seamless-content` — iframe + spinner de chargement
 * - `.cp-seamless-result` — écran succès/échec post-paiement
 * - `.cp-seamless-footer` — mention "Paiement sécurisé par CinetPay"
 * - `.cp-dark` — variante thème sombre
 *
 * Responsive : sur mobile (< 480px), le modal passe en plein écran.
 */
export const STYLES = `
.cp-seamless-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.cp-seamless-overlay.cp-visible {
  opacity: 1;
}

.cp-seamless-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  transform: translateY(20px) scale(0.95);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
}

.cp-seamless-overlay.cp-visible .cp-seamless-modal {
  transform: translateY(0) scale(1);
}

.cp-seamless-modal.cp-dark {
  background: #1a1a2e;
  color: #e0e0e0;
}

/* Header */
.cp-seamless-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.cp-dark .cp-seamless-header {
  border-bottom-color: #2a2a3e;
}

.cp-seamless-logo {
  height: 28px;
}

.cp-seamless-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: #666;
  font-size: 18px;
  line-height: 1;
  transition: background 0.2s;
}

.cp-seamless-close:hover {
  background: #f5f5f5;
}

.cp-dark .cp-seamless-close {
  color: #999;
}

.cp-dark .cp-seamless-close:hover {
  background: #2a2a3e;
}

/* Content (iframe) */
.cp-seamless-content {
  flex: 1;
  min-height: 400px;
  position: relative;
}

.cp-seamless-content iframe {
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: none;
}

/* Loading */
.cp-seamless-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #fff;
}

.cp-dark .cp-seamless-loading {
  background: #1a1a2e;
}

.cp-seamless-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #e8530e;
  border-radius: 50%;
  animation: cp-spin 0.8s linear infinite;
}

.cp-dark .cp-seamless-spinner {
  border-color: #2a2a3e;
  border-top-color: #e8530e;
}

@keyframes cp-spin {
  to { transform: rotate(360deg); }
}

.cp-seamless-loading-text {
  color: #999;
  font-size: 14px;
}

/* Result */
.cp-seamless-result {
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cp-seamless-result-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.cp-seamless-result-icon.cp-success {
  background: #e8f5e9;
  color: #2e7d32;
}

.cp-seamless-result-icon.cp-failure {
  background: #fbe9e7;
  color: #c62828;
}

.cp-dark .cp-seamless-result-icon.cp-success {
  background: #1b3a1e;
}

.cp-dark .cp-seamless-result-icon.cp-failure {
  background: #3a1b1b;
}

.cp-seamless-result-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.cp-seamless-result-message {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.cp-dark .cp-seamless-result-message {
  color: #999;
}

.cp-seamless-result-btn {
  margin-top: 8px;
  padding: 12px 32px;
  border: none;
  border-radius: 8px;
  background: #e8530e;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.cp-seamless-result-btn:hover {
  background: #d14a0c;
}

/* Footer */
.cp-seamless-footer {
  padding: 12px 24px;
  border-top: 1px solid #f0f0f0;
  text-align: center;
  font-size: 11px;
  color: #999;
}

.cp-dark .cp-seamless-footer {
  border-top-color: #2a2a3e;
}

/* Mobile */
@media (max-width: 480px) {
  .cp-seamless-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
    height: 100%;
  }
}
`
