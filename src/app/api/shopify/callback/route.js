import { NextResponse } from 'next/server';
import { exchangeCodeForToken, getShopifyConfig, normalizeShop, verifyShopifyHmac } from '../../../../lib/shopify';

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
  const response = NextResponse.redirect(`${appUrl}/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);

  response.cookies.set('shopify_shop', shop, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set('shopify_installed', '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.delete('shopify_oauth_state');

  // Persist tokenData.access_token by shop before using Admin API calls in production.
  console.log(`Shopify app installed for ${shop}. Scopes: ${tokenData.scope || 'none'}`);
  return response;
}
