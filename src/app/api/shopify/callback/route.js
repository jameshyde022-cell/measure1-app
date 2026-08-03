import { NextResponse } from 'next/server';
import { exchangeCodeForToken, getShopifyConfig, normalizeShop, persistShopToken, verifyShopifyHmac } from '../../../../lib/shopify';

export async function GET(request) {
  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop'));
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const host = url.searchParams.get('host') || '';
  const savedState = request.cookies.get('shopify_oauth_state')?.value;
  const { apiSecret, appUrl } = getShopifyConfig();

  if (!shop || !code || !state) {
    return NextResponse.json({ error: 'Missing Shopify OAuth parameters.' }, { status: 400 });
  }

  if (!savedState || savedState !== state) {
    return NextResponse.json({ error: 'Invalid Shopify OAuth state.' }, { status: 400 });
  }

  if (!verifyShopifyHmac(url.searchParams, apiSecret)) {
    return NextResponse.json({ error: 'Invalid Shopify HMAC.' }, { status: 400 });
  }

  const tokenData = await exchangeCodeForToken({ shop, code });
  // Session identification now happens via verified App Bridge session tokens
  // (see lib/shopify.js verifySessionToken), not cookies.
  const response = NextResponse.redirect(`${appUrl}/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);

  await persistShopToken({ shop, tokenData });
  console.log(`Shopify app installed for ${shop}. Scopes: ${tokenData.scope || 'none'}`);
  return response;
}
