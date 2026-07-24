# Paywall Setup & Test Checklist

## Plans

| | Free | Pro (Stripe subscription) |
|---|---|---|
| PNG exports | 1 per day | Unlimited |
| Background removal (PhotoRoom) | 1 per day | Unlimited |
| Annotate / crop / erase | Unlimited | Unlimited |

Guests (not logged in) can play with the tool but must log in to export or remove backgrounds. All limits are enforced server-side (Supabase RPCs + API routes), not just in the UI.

## One-time setup

### 1. Supabase
Open Supabase Dashboard → SQL Editor → paste and run **`docs/supabase-setup.sql`**.
It is idempotent (safe to re-run) and does the following:
- Adds missing `profiles` columns (`bg_count_*`, `stripe_customer_id`, `stripe_subscription_id`)
- Creates profiles automatically on signup (trigger) and backfills existing users
- Locks down RLS so clients can only *read* their own profile (nobody can self-assign `plan = 'pro'`)
- Creates/replaces `consume_export`, `get_export_status`, `consume_bg_removal` (free limit = 1/day)

If you previously created profile policies with other names, drop them in
Dashboard → Authentication → Policies (the script drops the common ones).

### 2. Stripe
- Webhook endpoint: `https://YOUR-DOMAIN/api/stripe-webhook`
- Enable these events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Enable the **Customer Portal** (Settings → Billing → Customer portal) so "Manage Billing" works.

### 3. Environment variables (local `.env.local` and Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` (the Pro subscription price)
- `STRIPE_WEBHOOK_SECRET`
- `PHOTOROOM_API_KEY`
- `NEXT_PUBLIC_SITE_URL` (`http://localhost:3000` locally, your real URL in production)

Note: `.env.txt` and `.env` in the repo root are now gitignored. `.env.txt` contains
a live Stripe secret key — merge anything you need into `.env.local` and delete it.

## End-to-end test (Stripe test mode)

1. `npm run dev`, sign up a new user, confirm a `profiles` row appeared with `plan = 'free'`.
2. Annotate an image → Generate Sheet → Download PNG (works once).
3. Download again → blocked with "1 export per day" message; footer shows `0 OF 1 EXPORT LEFT TODAY`.
4. Remove Background works once, second attempt blocked with upgrade message.
5. Click **Upgrade to Pro** → Stripe Checkout (card `4242 4242 4242 4242`) → redirected back with success banner.
6. After the webhook fires, profile shows `plan = 'pro'` + `stripe_customer_id`; exports and background removal are unlimited; button becomes **Manage Billing**.
7. Cancel the subscription in the billing portal (or Stripe dashboard) → webhook downgrades profile to `free`.
8. Logged-out user: hitting `/api/remove-bg` directly returns 401; Download PNG prompts login.

For local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
(use the printed signing secret as `STRIPE_WEBHOOK_SECRET`).
