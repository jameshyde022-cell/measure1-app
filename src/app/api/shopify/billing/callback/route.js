import { NextResponse } from 'next/server';
import { getShopifyConfig, normalizeShop, verifyActiveSubscription } from '../../../../../lib/shopify';

export async function GET(request) {
  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop'));
  const { appUrl } = getShopifyConfig();

  if (!shop) {
    return NextResponse.json({ error: 'Missing or invalid shop.' }, { status: 400 });
  }

  try {
    await verifyActiveSubscription(shop);
  } catch (error) {
    console.error(`[billing/callback] verify failed for ${shop}:`, error.message);
  }

  return NextResponse.redirect(`${appUrl}/?shop=${encodeURIComponent(shop)}&billing=complete`);
}
