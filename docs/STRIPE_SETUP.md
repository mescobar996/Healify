# Stripe Configuration Guide for Healify

This guide will walk you through setting up Stripe for the Healify subscription system.

## Table of Contents
1. [Create Stripe Account](#1-create-stripe-account)
2. [Get API Keys](#2-get-api-keys)
3. [Create Products and Prices](#3-create-products-and-prices)
4. [Configure Webhook](#4-configure-webhook)
5. [Update Environment Variables](#5-update-environment-variables)
6. [Testing](#6-testing)

---

## 1. Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/register)
2. Sign up for a new account or log in to your existing account
3. Complete the account activation process (provide business details)

---

## 2. Get API Keys

1. Navigate to [Developers → API Keys](https://dashboard.stripe.com/test/apikeys)
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`) - Used in frontend
   - **Secret key** (starts with `sk_test_` or `sk_live_`) - Used in backend

3. Copy the **Secret key** and add it to your `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
   ```

> ⚠️ **Important**: Never expose your secret key in client-side code!

---

## 3. Create Products and Prices

### Step 3.1: Create Products

1. Go to [Products](https://dashboard.stripe.com/products)
2. Click **"Add product"**

#### Product 1: Starter Plan
```
Name: Starter
Description: Perfect for small teams getting started

Pricing:
- Price: $49
- Billing period: Monthly
- Price ID: price_starter_monthly (you'll get the actual ID after creation)
```

#### Product 2: Pro Plan
```
Name: Pro
Description: For growing teams that need more

Pricing:
- Price: $99
- Billing period: Monthly
- Price ID: price_pro_monthly
```

#### Product 3: Enterprise Plan
```
Name: Enterprise
Description: For large-scale organizations

Pricing:
- Price: $499
- Billing period: Monthly
- Price ID: price_enterprise_monthly
```

### Step 3.2: Get Price IDs

After creating each product, you'll see a **Price ID** that looks like:
- `price_1MrS1ALlCfXeO...` (test mode)
- `price_1MrS1ALlCfXeO...` (live mode)

Copy these Price IDs to your `.env`:
```env
STRIPE_STARTER_PRICE_ID=price_1MrS1ALlCfXeO...
STRIPE_PRO_PRICE_ID=price_1MrS2BLlCfXeO...
STRIPE_ENTERPRISE_PRICE_ID=price_1MrS3CLlCfXeO...
```

---

## 4. Configure Webhook

### Step 4.1: Create Webhook Endpoint

1. Go to [Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**

### Step 4.2: Configure for Local Development (with Stripe CLI)

For local development, use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# Windows (with Scoop):
scoop install stripe

# Or download from: https://github.com/stripe/stripe-cli/releases

# Login to Stripe
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

This will output a webhook signing secret like:
```
whsec_1234567890abcdef...
```

Copy this to your `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

### Step 4.3: Configure for Production

1. In Webhooks, click **"Add endpoint"**
2. Enter your production URL:
   ```
   https://your-domain.com/api/webhook/stripe
   ```
3. Select these events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. Click **"Add endpoint"**
5. Copy the **Signing secret** (starts with `whsec_`) to your `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_production_signing_secret
   ```

---

## 5. Update Environment Variables

Your complete `.env` Stripe section should look like:

```env
# ============================================
# STRIPE (Payments)
# ============================================
# Test Mode Keys (use live keys in production)
STRIPE_SECRET_KEY=sk_test_51MrS...
STRIPE_WEBHOOK_SECRET=whsec_123456...

# Price IDs from Stripe Dashboard
STRIPE_STARTER_PRICE_ID=price_1MrS1ALlCfXeO...
STRIPE_PRO_PRICE_ID=price_1MrS2BLlCfXeO...
STRIPE_ENTERPRISE_PRICE_ID=price_1MrS3CLlCfXeO...
```

---

## 6. Testing

### Test with Stripe CLI (Local)

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. In another terminal, start Stripe webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```

3. Use Stripe Test Cards:
   | Card Number | Result |
   |-------------|--------|
   | `4242 4242 4242 4242` | Success |
   | `4000 0000 0000 0002` | Decline |
   | `4000 0000 0000 9995` | Insufficient funds |
   | `4000 0025 0000 3155` | 3D Secure required |

   Any future expiry date and any 3-digit CVC works.

### Test Webhook Events

Trigger test events with Stripe CLI:
```bash
# Trigger checkout.session.completed
stripe trigger checkout.session.completed

# Trigger subscription events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### Verify in Dashboard

1. Go to [Stripe Dashboard → Events](https://dashboard.stripe.com/events)
2. You should see the webhook events being received
3. Click on an event to see the full request/response

---

## Troubleshooting

### Webhook Signature Verification Failed
- Ensure `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe
- Make sure you're using the raw request body (not parsed JSON)

### Subscription Not Updating
- Check the server logs for errors
- Verify the webhook is being received in Stripe Dashboard → Events
- Ensure the `stripeCustomerId` is correctly stored in your database

### Price ID Not Found
- Verify the Price IDs in `.env` match exactly what's in Stripe Dashboard
- Make sure you're using test mode Price IDs with test mode API keys

---

## Going Live

1. Switch to live mode in Stripe Dashboard (toggle in top right)
2. Get live API keys from [API Keys](https://dashboard.stripe.com/live/apikeys)
3. Create products in live mode (or they'll be copied from test mode)
4. Update your `.env` with live keys and Price IDs
5. Create a production webhook endpoint with your live domain
6. Test with a real card (you can refund immediately after)

---

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Testing Stripe](https://stripe.com/docs/testing)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
