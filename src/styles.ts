/**
 * Styles CSS du checkout CinetPay Seamless (mode popup).
 */
export const STYLES = `
.cp-seamless-overlay {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
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

.cp-seamless-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Waiting screen (pendant que la popup est ouverte) */
.cp-seamless-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  padding: 40px;
}

.cp-seamless-waiting-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}

.cp-seamless-waiting-msg {
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}

.cp-seamless-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #e8530e;
  border-radius: 50%;
  animation: cp-spin 0.8s linear infinite;
}

@keyframes cp-spin {
  to { transform: rotate(360deg); }
}

.cp-seamless-cancel-btn {
  margin-top: 12px;
  padding: 10px 28px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.cp-seamless-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* Result screen (succès/échec après fermeture popup) */
.cp-seamless-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding: 40px;
}

.cp-seamless-result-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
}

.cp-seamless-result-icon.cp-success {
  background: rgba(46, 125, 50, 0.2);
  color: #66bb6a;
}

.cp-seamless-result-icon.cp-failure {
  background: rgba(198, 40, 40, 0.2);
  color: #ef5350;
}

.cp-seamless-result-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.cp-seamless-result-message {
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  margin: 0;
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
`
