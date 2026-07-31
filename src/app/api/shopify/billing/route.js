import { NextResponse } from 'next/server';
import { createAppSubscription, getShopifyBillingStatus, normalizeShop } from '../../../../lib/shopify';

export async function GET(request) {
  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop'));

  if (!shop) {
    return NextResponse.json({ error: 'Missing or invalid shop.' }, { status: 400 });
  }

  try {
    const status = await getShopifyBillingStatus(shop);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load billing status' }, { status: 500 });
  }
}

export async function POST(request) {
  const { shop: rawShop } = await request.json().catch(() => ({}));
  const shop = normalizeShop(rawShop);

  if (!shop) {
    return NextResponse.json({ error: 'Missing or invalid shop.' }, { status: 400 });
  }

  try {
    const confirmationUrl = await createAppSubscription({ shop });
    return NextResponse.json({ confirmationUrl });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to start subscription' }, { status: 500 });
  }
}
