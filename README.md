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
| `paymentMethod` | `string` | Non | Opérateur spécifique (ex: OM_CI, WAVE_SN) |
| `clientPhoneNumber` | `string` | Non | Téléphone (format international) |

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
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; }
    h2 { margin-bottom: 20px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 14px; }
    input, select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; }
    .row { display: flex; gap: 12px; }
    .row .form-group { flex: 1; }
    .pay-btn { width: 100%; padding: 14px; background: #e8530e; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .pay-btn:hover { background: #d14a0c; }
    .pay-btn:disabled { background: #ccc; cursor: not-allowed; }
    .status { margin-top: 20px; padding: 16px; border-radius: 8px; display: none; font-size: 14px; }
    .status.success { display: block; background: #e8f5e9; color: #2e7d32; }
    .status.error { display: block; background: #fbe9e7; color: #c62828; }
  </style>
</head>
<body>
  <h2>Finaliser votre commande</h2>

  <form id="payment-form">
    <div class="form-group">
      <label>Article</label>
      <input type="text" id="designation" value="T-shirt CinetPay" readonly>
    </div>
    <div class="row">
      <div class="form-group">
        <label>Montant</label>
        <input type="number" id="amount" value="5000" min="100">
      </div>
      <div class="form-group">
        <label>Devise</label>
        <select id="currency">
          <option value="XOF" selected>XOF</option>
          <option value="XAF">XAF</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="form-group">
        <label>Prénom</label>
        <input type="text" id="firstName" required placeholder="Jean">
      </div>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" id="lastName" required placeholder="Dupont">
      </div>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="email" required placeholder="jean@email.com">
    </div>
    <div class="form-group">
      <label>Téléphone</label>
      <input type="tel" id="phone" required placeholder="+2250707000000">
    </div>
    <button type="submit" class="pay-btn" id="payBtn">Payer 5 000 XOF</button>
  </form>

  <div class="status" id="status"></div>

  <script>
    // Mettre à jour le bouton quand le montant change
    document.getElementById('amount').addEventListener('input', function() {
      var currency = document.getElementById('currency').value
      document.getElementById('payBtn').textContent = 'Payer ' + Number(this.value).toLocaleString('fr') + ' ' + currency
    })

    document.getElementById('payment-form').addEventListener('submit', function(e) {
      e.preventDefault()

      var btn = document.getElementById('payBtn')
      var statusEl = document.getElementById('status')
      btn.disabled = true
      btn.textContent = 'Chargement...'
      statusEl.className = 'status'

      CinetPaySeamless.open({
        // Mode Direct — en production, utilisez le mode Backend
        apiKey: 'sk_test_...',
        apiPassword: 'your_password',
        country: 'CI',
        merchantTransactionId: 'CMD-' + Date.now(),
        amount: parseInt(document.getElementById('amount').value),
        currency: document.getElementById('currency').value,
        designation: document.getElementById('designation').value,
        clientFirstName: document.getElementById('firstName').value,
        clientLastName: document.getElementById('lastName').value,
        clientEmail: document.getElementById('email').value,
        clientPhoneNumber: document.getElementById('phone').value,
        notifyUrl: 'https://votre-site.com/webhook',
        successUrl: 'https://votre-site.com/success',
        failedUrl: 'https://votre-site.com/failed',
        channel: 'PUSH',

        onResponse: function(data) {
          if (data.status === 'ACCEPTED') {
            statusEl.className = 'status success'
            statusEl.textContent = 'Paiement réussi ! Montant: ' + data.amount + ' ' + data.currency
          } else {
            statusEl.className = 'status error'
            statusEl.textContent = 'Paiement refusé. Veuillez réessayer.'
          }
        },

        onClose: function() {
          btn.disabled = false
          var currency = document.getElementById('currency').value
          btn.textContent = 'Payer ' + Number(document.getElementById('amount').value).toLocaleString('fr') + ' ' + currency
        },

        onError: function(err) {
          statusEl.className = 'status error'
          statusEl.textContent = 'Erreur: ' + err.message
          btn.disabled = false
          btn.textContent = 'Réessayer'
        }
      })
    })
  </script>
</body>
</html>
```

### React (formulaire complet)

```tsx
import { useState } from 'react'
import { CinetPaySeamless } from 'cinetpay-seamless'

function CheckoutForm() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    amount: 5000, currency: 'XOF',
  })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatus('idle')

    try {
      // Appeler votre backend pour initialiser le paiement
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const { paymentToken } = await res.json()

      CinetPaySeamless.open({
        paymentToken,
        onResponse: (data) => {
          setStatus(data.status === 'ACCEPTED' ? 'success' : 'error')
        },
        onClose: () => setLoading(false),
        onError: () => {
          setStatus('error')
          setLoading(false)
        },
      })
    } catch {
      setStatus('error')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: 12 }}>
        <input placeholder="Prénom" required
          value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
        <input placeholder="Nom" required
          value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
      </div>
      <input type="email" placeholder="Email" required
        value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      <input type="tel" placeholder="+2250707000000" required
        value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      <div style={{ display: 'flex', gap: 12 }}>
        <input type="number" min={100} required
          value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} />
        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
          <option value="XOF">XOF</option>
          <option value="XAF">XAF</option>
        </select>
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Chargement...' : `Payer ${form.amount.toLocaleString('fr')} ${form.currency}`}
      </button>

      {status === 'success' && <p style={{ color: 'green' }}>Paiement réussi !</p>}
      {status === 'error' && <p style={{ color: 'red' }}>Paiement échoué. Réessayez.</p>}
    </form>
  )
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
