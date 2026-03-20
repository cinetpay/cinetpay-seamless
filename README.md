# cinetpay-seamless

CinetPay Seamless — paiement inline sans redirection pour applications web.

Le modal de paiement s'affiche directement dans votre page. Le client ne quitte jamais votre site.

## Installation

### npm / yarn / pnpm

```bash
npm install cinetpay-seamless
```

### CDN (script tag)

```html
<script src="https://unpkg.com/cinetpay-seamless/dist/cinetpay-seamless.umd.cjs"></script>
```

## Utilisation

### Mode Backend (recommandé)

Le serveur initialise le paiement via le SDK `cinetpay-js` et passe le `paymentToken` au frontend.

```typescript
import { CinetPaySeamless } from 'cinetpay-seamless'

const { paymentToken } = await fetch('/api/pay', {
  method: 'POST',
  body: JSON.stringify({ amount: 5000, orderId: 'ORDER-001' }),
}).then(r => r.json())

CinetPaySeamless.open({
  paymentToken,
  onPaymentSuccess: (data) => {
    console.log('Paiement réussi !', data.amount, data.currency)
  },
  onPaymentFailed: (data) => {
    console.log('Paiement refusé', data.transactionId)
  },
  onClose: ({ status }) => {
    console.log('Modal fermé, statut:', status)
  },
})
```

### Mode Direct (sans backend)

Le frontend s'authentifie (JWT) et initialise le paiement directement via l'API v1 CinetPay.

> **Attention** : les credentials (`apiKey` + `apiPassword`) sont exposés dans le code source.
> Acceptable en sandbox, mais en production préférez le mode Backend.

```typescript
import { CinetPaySeamless } from 'cinetpay-seamless'

CinetPaySeamless.open({
  apiKey: 'sk_test_...',
  apiPassword: 'your_password',
  country: 'CI',
  merchantTransactionId: `ORDER-${Date.now()}`,
  amount: 5000,
  currency: 'XOF',
  designation: 'Achat en ligne',
  clientEmail: 'jean@email.com',
  clientFirstName: 'Jean',
  clientLastName: 'Dupont',
  clientPhoneNumber: '+2250707000000',
  notifyUrl: 'https://monsite.com/webhook',
  successUrl: 'https://monsite.com/success',
  failedUrl: 'https://monsite.com/failed',
  channel: 'PUSH',
  onPaymentSuccess: (data) => console.log('Payé !', data),
  onPaymentFailed: (data) => console.log('Refusé', data),
  onError: (err) => console.error(err.code, err.message),
})
```

### CDN / Vanilla JS

```html
<script src="https://unpkg.com/cinetpay-seamless/dist/cinetpay-seamless.umd.cjs"></script>
<script>
  document.getElementById('pay-btn').addEventListener('click', function() {
    CinetPaySeamless.open({
      apiKey: 'sk_test_...',
      apiPassword: 'your_password',
      country: 'CI',
      merchantTransactionId: 'ORDER-' + Date.now(),
      amount: 1000,
      currency: 'XOF',
      designation: 'Achat',
      clientEmail: 'client@email.com',
      clientFirstName: 'Jean',
      clientLastName: 'Dupont',
      notifyUrl: 'https://monsite.com/webhook',
      successUrl: 'https://monsite.com/success',
      failedUrl: 'https://monsite.com/failed',
      onPaymentSuccess: function(data) {
        alert('Merci ! ' + data.amount + ' ' + data.currency)
      },
      onPaymentFailed: function(data) {
        alert('Paiement échoué')
      },
    })
  })
</script>
```

## Event Listener (style Stripe)

En plus des callbacks dans `open()`, vous pouvez écouter les événements globalement avec `on()` / `off()` / `once()` :

```typescript
import { CinetPaySeamless } from 'cinetpay-seamless'

// Enregistrer les listeners AVANT d'ouvrir le modal
CinetPaySeamless.on('ready', () => {
  console.log('Passerelle de paiement chargée')
})

CinetPaySeamless.on('payment.success', (data) => {
  console.log('Paiement accepté !', data.amount, data.currency)
  // Mettre à jour l'interface, rediriger, etc.
})

CinetPaySeamless.on('payment.failed', (data) => {
  console.log('Paiement refusé', data.transactionId)
})

CinetPaySeamless.on('payment.pending', (data) => {
  console.log('En attente...', data.status) // PENDING, INITIATED, EXPIRED
})

CinetPaySeamless.on('close', ({ status }) => {
  console.log('Modal fermé, dernier statut:', status)
})

CinetPaySeamless.on('error', (err) => {
  console.error('Erreur:', err.code, err.message)
})

// Ouvrir le modal — les listeners sont déjà en place
CinetPaySeamless.open({ paymentToken: 'abc...' })
```

### Désabonnement

```typescript
// on() retourne une fonction de désabonnement
const unsubscribe = CinetPaySeamless.on('payment.success', handler)
unsubscribe() // Plus de notifications

// Ou avec off()
CinetPaySeamless.off('payment.success', handler)

// once() pour un handler unique
CinetPaySeamless.once('payment.success', (data) => {
  // Appelé une seule fois
})
```

## API

### `CinetPaySeamless.open(config)`

Ouvre le modal de paiement.

#### Config commune

| Option | Type | Default | Description |
|---|---|---|---|
| `lang` | `'fr' \| 'en'` | `'fr'` | Langue de l'interface |
| `closeAfterResponse` | `boolean` | `true` | Afficher l'écran de résultat |
| `theme` | `'light' \| 'dark'` | `'light'` | Thème du modal |
| `debug` | `boolean` | `false` | Active les logs console `[CinetPay Seamless]` |
| `onReady` | `() => void` | - | Iframe chargée, passerelle visible |
| `onPaymentSuccess` | `(data) => void` | - | Paiement accepté (ACCEPTED) |
| `onPaymentFailed` | `(data) => void` | - | Paiement refusé (REFUSED) |
| `onPaymentPending` | `(data) => void` | - | En attente (PENDING, INITIATED, EXPIRED) |
| `onClose` | `({ status }) => void` | - | Modal fermé |
| `onError` | `(error) => void` | - | Erreur technique |

#### Config mode Backend

| Option | Type | Required | Description |
|---|---|---|---|
| `paymentToken` | `string` | Oui | Token obtenu via le SDK backend `cinetpay-js` |

#### Config mode Direct

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Oui | Clé API CinetPay (`sk_test_...` ou `sk_live_...`) |
| `apiPassword` | `string` | Oui | Mot de passe API CinetPay |
| `country` | `string` | Oui | Code pays ISO (ex: CI, SN, CM) |
| `merchantTransactionId` | `string` | Oui | Identifiant unique de la transaction (max 30 chars) |
| `amount` | `number` | Oui | Montant (entier, min: 100, max: 2 500 000) |
| `currency` | `string` | Oui | Devise : XOF, XAF, GNF, CDF, USD |
| `designation` | `string` | Oui | Libellé du paiement |
| `clientEmail` | `string` | Oui | Email du client |
| `clientFirstName` | `string` | Oui | Prénom du client |
| `clientLastName` | `string` | Oui | Nom du client |
| `notifyUrl` | `string` | Oui | URL de webhook |
| `successUrl` | `string` | Oui | URL de redirection après succès |
| `failedUrl` | `string` | Oui | URL de redirection après échec |
| `channel` | `string` | Non | `PUSH`, `OTP`, `QRCODE` (défaut: PUSH) |
| `paymentMethod` | `string` | Non | Opérateur (ex: OM_CI, WAVE_SN) |
| `clientPhoneNumber` | `string` | Non | Téléphone (format international) |

### `CinetPaySeamless.on(event, handler)`

Enregistre un listener d'événement. Retourne une fonction de désabonnement.

| Événement | Donnée | Description |
|---|---|---|
| `ready` | — | Iframe chargée |
| `payment.success` | `PaymentResponse` | Paiement accepté |
| `payment.failed` | `PaymentResponse` | Paiement refusé |
| `payment.pending` | `PaymentResponse` | En attente |
| `close` | `{ status: string }` | Modal fermé |
| `error` | `PaymentError` | Erreur technique |

### `CinetPaySeamless.off(event, handler)`

Supprime un listener.

### `CinetPaySeamless.once(event, handler)`

Listener appelé une seule fois.

### `CinetPaySeamless.close()`

Ferme le modal programmatiquement.

### `PaymentResponse`

```typescript
{
  amount: number
  currency: string
  status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'INITIATED' | 'EXPIRED' | 'UNKNOWN'
  paymentMethod: string
  description: string
  transactionId: string
  metadata?: string
  operatorId?: string
  paymentDate?: string
}
```

## Exemple complet avec formulaire

### HTML / Vanilla JS

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement — Mon Site</title>
  <script src="https://unpkg.com/cinetpay-seamless/dist/cinetpay-seamless.umd.cjs"></script>
</head>
<body>
  <form id="payment-form">
    <input type="text" id="firstName" required placeholder="Prénom">
    <input type="text" id="lastName" required placeholder="Nom">
    <input type="email" id="email" required placeholder="Email">
    <input type="tel" id="phone" required placeholder="+2250707000000">
    <input type="number" id="amount" value="5000" min="100">
    <button type="submit">Payer</button>
  </form>

  <div id="status"></div>

  <script>
    // Listeners globaux
    CinetPaySeamless.on('payment.success', function(data) {
      document.getElementById('status').textContent = 'Payé ! ' + data.amount + ' ' + data.currency
    })

    CinetPaySeamless.on('payment.failed', function() {
      document.getElementById('status').textContent = 'Paiement refusé'
    })

    document.getElementById('payment-form').addEventListener('submit', function(e) {
      e.preventDefault()

      CinetPaySeamless.open({
        apiKey: 'sk_test_...',
        apiPassword: 'your_password',
        country: 'CI',
        merchantTransactionId: 'CMD-' + Date.now(),
        amount: parseInt(document.getElementById('amount').value),
        currency: 'XOF',
        designation: 'Commande',
        clientFirstName: document.getElementById('firstName').value,
        clientLastName: document.getElementById('lastName').value,
        clientEmail: document.getElementById('email').value,
        clientPhoneNumber: document.getElementById('phone').value,
        notifyUrl: 'https://votre-site.com/webhook',
        successUrl: 'https://votre-site.com/success',
        failedUrl: 'https://votre-site.com/failed',
        debug: true,
      })
    })
  </script>
</body>
</html>
```

### React

```tsx
import { useEffect } from 'react'
import { CinetPaySeamless } from 'cinetpay-seamless'

function CheckoutPage() {
  useEffect(() => {
    const unsub = CinetPaySeamless.on('payment.success', (data) => {
      window.location.href = `/orders/${data.transactionId}/success`
    })
    return unsub // Cleanup on unmount
  }, [])

  const handlePay = async () => {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 5000 }),
    })
    const { paymentToken } = await res.json()

    CinetPaySeamless.open({ paymentToken, debug: true })
  }

  return <button onClick={handlePay}>Payer 5 000 XOF</button>
}
```

### Vue 3

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { CinetPaySeamless } from 'cinetpay-seamless'

let unsub: (() => void) | null = null

onMounted(() => {
  unsub = CinetPaySeamless.on('payment.success', (data) => {
    alert('Merci ! ' + data.amount + ' ' + data.currency)
  })
})

onUnmounted(() => unsub?.())

async function pay() {
  const res = await fetch('/api/pay', { method: 'POST', body: JSON.stringify({ amount: 5000 }) })
  const { paymentToken } = await res.json()
  CinetPaySeamless.open({ paymentToken })
}
</script>

<template>
  <button @click="pay">Payer 5 000 XOF</button>
</template>
```

## Debug

Activez les logs avec `debug: true` :

```typescript
CinetPaySeamless.open({
  paymentToken: 'abc...',
  debug: true,
})
```

Sortie console :
```
[CinetPay Seamless] CinetPaySeamless.open() called { mode: 'backend' }
[CinetPay Seamless] Mode Backend — opening with paymentToken
[CinetPay Seamless] Opening modal { paymentUrl: 'https://secure.cinetpay.net/checkout/abc...' }
[CinetPay Seamless] Iframe loaded — checkout ready
[CinetPay Seamless] Payment response: ACCEPTED { amount: 5000, currency: 'XOF', ... }
[CinetPay Seamless] Payment accepted
[CinetPay Seamless] Modal closed { lastStatus: 'ACCEPTED' }
```

## Sécurité

- **Mode Backend** (recommandé) : les credentials restent côté serveur
- **Mode Direct** : warning console si utilisé hors localhost
- **postMessage** : whitelist stricte des domaines CinetPay (bloque les domaines lookalike)
- **Iframe sandboxé** : `allow-scripts allow-same-origin allow-forms allow-popups` (pas de `allow-top-navigation`)
- **paymentToken validé** : regex `[a-zA-Z0-9_-]{10,128}` avant injection dans l'URL
- **Timeout** : 30s sur les requêtes fetch (auth + payment init)
- **Zero dépendance** runtime

## Environnements

| Clé API | URL API | Environnement |
|---|---|---|
| `sk_test_...` | `https://api.cinetpay.net` | Sandbox |
| `sk_live_...` | `https://api.cinetpay.co` | Production |

Auto-détecté à partir du préfixe de la clé API.

## Support

Pour toute question : **support@cinetpay.com**

## Licence

MIT
