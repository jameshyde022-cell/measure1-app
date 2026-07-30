import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { buildShopifyAuthUrl, getShopifyConfig, normalizeShop, verifyShopifyHmac } from '../../../../lib/shopify';

export async function GET(request) {
  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop'));
  const { apiKey, apiSecret, appUrl } = getShopifyConfig();

  if (!apiKey || !apiSecret || !appUrl) {
    return NextResponse.json({ error: 'Missing Shopify app environment variables.' }, { status: 500 });
  }

  if (!shop) {
    return NextResponse.json({ error: 'Missing or invalid shop parameter.' }, { status: 400 });
  }

  if (url.searchParams.get('hmac') && !verifyShopifyHmac(url.searchParams, apiSecret)) {
    return NextResponse.json({ error: 'Invalid Shopify HMAC.' }, { status: 400 });
  }

  const state = randomUUID();
  const response = NextResponse.redirect(buildShopifyAuthUrl({ shop, state }));
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 10,
  });
  return response;
}
