import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const MONTHLY_GENERATION_LIMIT = 150;
const TRIAL_GENERATION_LIMIT = 15;
const SUBSCRIPTION_PRICE_USD = 12.95;
const TRIAL_DAYS = 7;

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
      expiring: 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function refreshShopToken({ shop, refreshToken }) {
  const { apiKey, apiSecret } = getShopifyConfig();
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token refresh failed: ${response.status} ${text}`);
  }

  const tokenData = await response.json();
  await persistShopToken({ shop, tokenData });
  return tokenData.access_token;
}

export function verifyShopifyWebhookHmac(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function persistShopToken({ shop, tokenData }) {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabaseAdmin
    .from('shopify_shops')
    .upsert({
      shop,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
    }, { onConflict: 'shop' });

  if (error) throw error;
}

async function getValidAccessToken(shop) {
  const { data: row, error } = await supabaseAdmin
    .from('shopify_shops')
    .select('access_token, refresh_token, token_expires_at')
    .eq('shop', shop)
    .single();

  if (error || !row?.access_token) {
    throw new Error('No stored Shopify access token for this shop');
  }

  // Refresh if expired or expiring within the next 2 minutes.
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : null;
  if (expiresAt && expiresAt - Date.now() < 2 * 60 * 1000) {
    if (!row.refresh_token) {
      throw new Error('Shopify access token expired and no refresh token is stored');
    }
    return refreshShopToken({ shop, refreshToken: row.refresh_token });
  }

  return row.access_token;
}

async function shopifyAdminGraphQL({ shop, query, variables }) {
  const accessToken = await getValidAccessToken(shop);

  const response = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  if (!response.ok || json.errors) {
    throw new Error(`Shopify Admin API error: ${JSON.stringify(json.errors || json)}`);
  }
  return json.data;
}

async function isDevelopmentStore(shop) {
  const data = await shopifyAdminGraphQL({
    shop,
    query: `query { shop { plan { partnerDevelopment } } }`,
  });
  return Boolean(data?.shop?.plan?.partnerDevelopment);
}

export async function createAppSubscription({ shop }) {
  const { appUrl } = getShopifyConfig();
  const test = await isDevelopmentStore(shop);

  const data = await shopifyAdminGraphQL({
    shop,
    query: `mutation CreateSubscription($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
      appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, trialDays: $trialDays, test: $test) {
        confirmationUrl
        appSubscription { id }
        userErrors { field message }
      }
    }`,
    variables: {
      name: 'Measure Pro',
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: SUBSCRIPTION_PRICE_USD, currencyCode: 'USD' },
            interval: 'EVERY_30_DAYS',
          },
        },
      }],
      returnUrl: `${appUrl}/api/shopify/billing/callback?shop=${encodeURIComponent(shop)}`,
      trialDays: TRIAL_DAYS,
      test,
    },
  });

  const result = data?.appSubscriptionCreate;
  if (result?.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }

  const { error } = await supabaseAdmin
    .from('shopify_shops')
    .upsert({
      shop,
      plan: 'trialing',
      shopify_charge_id: result.appSubscription.id,
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
    }, { onConflict: 'shop' });
  if (error) throw error;

  return result.confirmationUrl;
}

export async function verifyActiveSubscription(shop) {
  const data = await shopifyAdminGraphQL({
    shop,
    query: `query { currentAppInstallation { activeSubscriptions { id status } } }`,
  });
  const active = data?.currentAppInstallation?.activeSubscriptions?.find(
    (s) => s.status === 'ACTIVE'
  );
  if (!active) return false;

  const { error } = await supabaseAdmin
    .from('shopify_shops')
    .update({ plan: 'active', shopify_charge_id: active.id })
    .eq('shop', shop);
  if (error) throw error;
  return true;
}

export async function consumeShopifyGeneration(shop) {
  const { data, error } = await supabaseAdmin.rpc('shopify_consume_generation', {
    p_shop: shop,
    p_limit: MONTHLY_GENERATION_LIMIT,
    p_trial_limit: TRIAL_GENERATION_LIMIT,
  });
  if (error) throw error;
  return data;
}

export async function getShopifyBillingStatus(shop) {
  const { data, error } = await supabaseAdmin.rpc('shopify_get_billing_status', {
    p_shop: shop,
    p_limit: MONTHLY_GENERATION_LIMIT,
    p_trial_limit: TRIAL_GENERATION_LIMIT,
  });
  if (error) throw error;
  return data;
}
