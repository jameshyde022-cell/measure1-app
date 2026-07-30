# Shopify App Setup

This project is still a Next.js app, but it now has a Shopify embedded-app mode.

## What changed

- Added Shopify App Bridge script support in `src/app/layout.js`.
- Added `shopify.app.toml` for Shopify CLI / Partner Dashboard setup.
- Added install and OAuth callback routes:
  - `/api/shopify/auth`
  - `/api/shopify/callback`
- Added Shopify mode on the homepage when Shopify passes `shop` and `host`.
- Added a `shopifyMode` path in `MeasureTool` so merchants can export PNGs without the existing Supabase login wall.

## Important production note

The OAuth callback currently completes Shopify's token exchange and sets install cookies, but it does not persist the offline access token. Before listing this publicly or using Admin API calls, store `tokenData.access_token` by shop in Supabase or another database.

If you only need the embedded measurement tool and do not call Shopify Admin APIs yet, this is enough for a development/custom app test.

## Shopify Partner Dashboard settings

Create or open an app in your Shopify Partner account.

Set:

- App URL: `https://YOUR-DOMAIN/api/shopify/auth`
- Allowed redirection URL: `https://YOUR-DOMAIN/api/shopify/callback`
- Embedded app: enabled

For local development with Shopify CLI, run:

```powershell
npm run shopify:config:link
npm run shopify:dev
```

For a manual local tunnel, set `SHOPIFY_APP_URL` and `NEXT_PUBLIC_SITE_URL` to the public HTTPS tunnel URL.

## Environment variables

Copy `.env.example` to `.env.local` and fill:

```text
NEXT_PUBLIC_SHOPIFY_API_KEY=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SHOPIFY_SCOPES=read_products
```

`NEXT_PUBLIC_SHOPIFY_API_KEY` and `SHOPIFY_API_KEY` are usually the same Shopify client ID.

Keep the existing variables if you still use PhotoRoom, Supabase, and Stripe in standalone mode.

## Test checklist

1. Run `npm run dev` and verify standalone mode still opens at `/`.
2. Visit `/?shop=your-dev-store.myshopify.com&host=TESTHOST` and confirm Shopify mode loads without the Supabase login wall.
3. Configure the app in Partner Dashboard.
4. Install on a development store.
5. Confirm the app opens inside Shopify Admin and the Measure tool loads.
6. Upload a garment image, annotate measurements, generate a sheet, and download PNG.

## Current limitations

- Shopify Billing API is not wired yet.
- Offline access tokens are not persisted yet.
- Background removal remains disabled in Shopify mode until billing/auth is designed for merchant stores.
- Existing Supabase/Stripe login and paywall remain available in standalone mode.
