# PontisGlobe VPS Gateway

A small standalone Node/TypeScript (Express) service that proxies PontisGlobe
payout calls from the **whitelisted VPS**.

PontisGlobe only accepts requests from the VPS's static (whitelisted) IP, so the
INRSettle app on Vercel **must not** call Pontis directly. Instead Vercel calls
this gateway, which holds the Pontis credentials and signs every request. The
Pontis API keys therefore never live on Vercel.

## Endpoints

| Method | Path             | Auth                              | Description                          |
| ------ | ---------------- | --------------------------------- | ------------------------------------ |
| POST   | `/health`        | none                              | Liveness check.                      |
| POST   | `/pontis/payout` | `x-inrsettle-gateway-secret`      | Login + `sendPayoutRequest`.         |
| POST   | `/pontis/status` | `x-inrsettle-gateway-secret`      | Login + `getPayoutStatus`.           |
| POST   | `/pontis/webhook` | Pontis HMAC headers              | Verify provider callback and forward it to INRSettle. |

Protected endpoints require the shared secret in the
`x-inrsettle-gateway-secret` header. It is compared in constant time against
`INRSETTLE_GATEWAY_SECRET` and must match the `PONTIS_GATEWAY_SECRET` configured
on Vercel.

### `POST /pontis/payout`

Body: a PontisGlobe payout request.

```json
{
  "idempotency_key": "stl_123",
  "country_code": "IN",
  "currency_code": "INR",
  "payment_method": "bank_local",
  "source_amount": "10.00",
  "source_currency": "USDT",
  "recipient_details": {
    "name": "Test Beneficiary",
    "account_number": "1234567890",
    "ifsc": "HDFC0001234"
  }
}
```

Response:

```json
{
  "ok": true,
  "transaction_id": "txn_abc",
  "status": "pending",
  "status_message": null,
  "provider_response": { "...": "raw Pontis envelope" },
  "error": null
}
```

### `POST /pontis/status`

Body: `{ "transaction_id": "txn_abc" }`. Response has the same shape as above.

## Environment

Copy `.env.example` to `.env` and fill in the real values (the `.env` file is
git-ignored — never commit real secrets):

```
PORT
INRSETTLE_GATEWAY_SECRET
INRSETTLE_APP_WEBHOOK_URL       # https://app.example.com/api/providers/pontis/webhook
INRSETTLE_APP_WEBHOOK_SECRET    # separate callback signing secret
PONTIS_BASE_URL
PONTIS_API_KEY
PONTIS_ENCRYPTION_SECRET   # base64url, decodes to exactly 32 bytes
PONTIS_HMAC_SECRET         # base64url HMAC-SHA256 key
PONTIS_EMAIL
PONTIS_PASSWORD
```

## Local development

From the repo root:

```bash
npm run gateway:pontis:dev      # tsx watch (hot reload)
```

or from this folder:

```bash
cd gateway/pontis
npm install
npm run dev
```

Smoke test:

```bash
curl -X POST http://localhost:8787/health
```

## Running on the VPS with pm2

Run all commands from `gateway/pontis` on the whitelisted VPS.

```bash
# 1. Install dependencies (production install is fine after building)
cd gateway/pontis
npm install

# 2. Create the .env file with the real Pontis credentials + gateway secret
cp .env.example .env
# ...edit .env...

# 3. Build the TypeScript to dist/
npm run build

# 4. Start under pm2 (compiled output)
pm2 start dist/server.js --name pontis-gateway

# Persist across reboots
pm2 save
pm2 startup        # follow the printed instruction once

# Useful pm2 commands
pm2 logs pontis-gateway
pm2 restart pontis-gateway
pm2 stop pontis-gateway
pm2 delete pontis-gateway
```

To update after pulling new code:

```bash
cd gateway/pontis
npm install
npm run build
pm2 restart pontis-gateway
```

### Alternative: run TypeScript directly (no build step)

If you prefer not to build, you can run the source with `tsx` under pm2:

```bash
pm2 start npm --name pontis-gateway -- run start:tsx
```

## Vercel side

The INRSettle app on Vercel only needs:

```
PONTIS_GATEWAY_URL=https://your-vps-host.example.com
PONTIS_GATEWAY_SECRET=<same value as INRSETTLE_GATEWAY_SECRET here>
PONTIS_GATEWAY_WEBHOOK_SECRET=<same value as INRSETTLE_APP_WEBHOOK_SECRET here>
```

Do **not** set any `PONTIS_*` API credentials on Vercel — they belong only on
this VPS.

Configure the Pontis callback URL as
`https://your-vps-host.example.com/pontis/webhook`. The gateway verifies the
Pontis HMAC over the exact raw bytes, validates the final-state payload, then
re-signs those same bytes for the application callback. The app never needs the
Pontis HMAC or API credentials.

The application writes verified events to its durable webhook inbox before
processing. The gateway currently forwards synchronously; production deployment
still needs a monitored retry/outbox on the gateway for the case where the app
is unavailable and the provider does not redeliver.
