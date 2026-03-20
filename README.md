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

// Le backend retourne un paymentToken après avoir initialisé le paiement
const { paymentToken } = await fetch('/api/pay', {
  method: 'POST',
  body: JSON.stringify({ amount: 5000, orderId: 'ORDER-001' }),
}).then(r => r.json())

// Ouvrir le modal de paiement
CinetPaySeamless.open({
  paymentToken,
  onResponse: (data) => {
    if (data.status === 'ACCEPTED') {
      console.log('Paiement réussi !', data)
    } else {
      console.log('Paiement refusé', data)
    }
  },
  onClose: ({ status }) => {
    console.log('Modal fermé, statut:', status)
  },
})
```

### Mode Direct (sans backend)

Le frontend appelle l'API CinetPay directement. Les credentials sont exposés dans le code source.

```typescript
import { CinetPaySeamless } from 'cinetpay-seamless'

CinetPaySeamless.open({
  apiKey: 'sk_test_...',
  siteId: 123456,
  transactionId: `ORDER-${Date.now()}`,
  amount: 5000,
  currency: 'XOF',
  description: 'Achat en ligne',
  notifyUrl: 'https://monsite.com/webhook',
  channels: 'ALL',
  customerName: 'Jean Dupont',
  customerEmail: 'jean@email.com',
  customerPhoneNumber: '+2250707000000',
  onResponse: (data) => {
    console.log(data.status, data.amount, data.currency)
  },
  onError: (err) => {
    console.error(err.code, err.message)
  },
})
```

### CDN / Vanilla JS

```html
<script src="https://unpkg.com/cinetpay-seamless/dist/cinetpay-seamless.umd.cjs"></script>
<script>
  document.getElementById('pay-btn').addEventListener('click', function() {
    CinetPaySeamless.open({
      apiKey: 'sk_test_...',
      siteId: 123456,
      transactionId: 'ORDER-' + Date.now(),
      amount: 1000,
      currency: 'XOF',
      description: 'Achat',
      notifyUrl: 'https://monsite.com/webhook',
      onResponse: function(data) {
        alert(data.status === 'ACCEPTED' ? 'Merci !' : 'Echec')
      },
    })
  })
</script>
```

## API

### `CinetPaySeamless.open(config)`

Ouvre le modal de paiement.

#### Config commune

| Option | Type | Default | Description |
|---|---|---|---|
| `lang` | `'fr' \| 'en'` | `'fr'` | Langue de l'interface |
| `closeAfterResponse` | `boolean` | `true` | Fermer automatiquement après la réponse |
| `theme` | `'light' \| 'dark'` | `'light'` | Thème du modal |
| `onResponse` | `function` | - | Callback paiement terminé |
| `onClose` | `function` | - | Callback modal fermé |
| `onError` | `function` | - | Callback erreur |

#### Config mode Backend

| Option | Type | Required | Description |
|---|---|---|---|
| `paymentToken` | `string` | Oui | Token obtenu via le SDK backend |

#### Config mode Direct

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Oui | Clé API CinetPay (`sk_test_...` ou `sk_live_...`) |
| `siteId` | `number` | Oui | Identifiant du site CinetPay |
| `transactionId` | `string` | Oui | Identifiant unique de la transaction |
| `amount` | `number` | Oui | Montant (entier, min: 100) |
| `currency` | `string` | Oui | Devise : XOF, XAF, GNF, CDF, USD |
| `description` | `string` | Oui | Description du paiement |
| `notifyUrl` | `string` | Oui | URL de webhook |
| `channels` | `string` | Non | `ALL`, `MOBILE_MONEY`, `CREDIT_CARD`, `WALLET` |
| `metadata` | `string` | Non | Données personnalisées |
| `customerName` | `string` | Non | Nom du client |
| `customerEmail` | `string` | Non | Email du client |
| `customerPhoneNumber` | `string` | Non | Téléphone (format international) |

### `CinetPaySeamless.close()`

Ferme le modal programmatiquement.

### `PaymentResponse`

```typescript
{
  amount: number
  currency: string
  status: 'ACCEPTED' | 'REFUSED'
  paymentMethod: string
  description: string
  transactionId: string
  metadata?: string
  operatorId?: string
  paymentDate?: string
}
```

## Intégrations framework

### React

```tsx
import { CinetPaySeamless } from 'cinetpay-seamless'

function PayButton({ amount, orderId }: { amount: number; orderId: string }) {
  const handlePay = async () => {
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId }),
    })
    const { paymentToken } = await res.json()

    CinetPaySeamless.open({
      paymentToken,
      onResponse: (data) => {
        if (data.status === 'ACCEPTED') {
          window.location.href = `/orders/${orderId}/success`
        }
      },
    })
  }

  return <button onClick={handlePay}>Payer {amount} XOF</button>
}
```

### Vue 3

```vue
<script setup lang="ts">
import { CinetPaySeamless } from 'cinetpay-seamless'

async function pay() {
  const res = await fetch('/api/pay', { method: 'POST', body: JSON.stringify({ amount: 5000 }) })
  const { paymentToken } = await res.json()

  CinetPaySeamless.open({
    paymentToken,
    onResponse: (data) => {
      if (data.status === 'ACCEPTED') alert('Merci !')
    },
  })
}
</script>

<template>
  <button @click="pay">Payer 5000 XOF</button>
</template>
```

## Sécurité

- **Mode Backend** (recommandé) : les credentials API restent côté serveur, seul le `paymentToken` est exposé au frontend
- **Mode Direct** : l'`apiKey` est visible dans le code source. Acceptable pour les clés sandbox, mais en production préférez le mode Backend
- Toujours vérifier le statut du paiement côté serveur via le webhook (`notifyUrl`) avant de livrer un service

## Support

Pour toute question : **support@cinetpay.com**

## Licence

MIT
