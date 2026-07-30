import crypto from 'crypto';

const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function getShopifyConfig() {
  const apiKey = process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const appUrl = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const scopes = process.env.SHOPIFY_SCOPES || 'read_products';

  return { apiKey, apiSecret, appUrl, scopes };
}

export function normalizeShop(shop) {
  if (!shop) return '';
  const value = shop.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!SHOP_RE.test(value)) return '';
  return value.toLowerCase();
}

export function verifyShopifyHmac(searchParams, secret) {
  if (!secret) return false;
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const entries = [];
  searchParams.forEach((value, key) => {
    if (key !== 'hmac' && key !== 'signature') {
      entries.push([key, value]);
    }
  });

  const message = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export function buildShopifyAuthUrl({ shop, state }) {
  const { apiKey, appUrl, scopes } = getShopifyConfig();
  const redirectUri = `${appUrl}/api/shopify/callback`;
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', apiKey);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken({ shop, code }) {
  const { apiKey, apiSecret } = getShopifyConfig();
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}
