import { NextResponse } from 'next/server';
import { createAppSubscription, getShopifyBillingStatus, verifySessionToken } from '../../../../lib/shopify';

export async function GET(request) {
  const shop = verifySessionToken(request.headers.get('authorization'));

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
  const shop = verifySessionToken(request.headers.get('authorization'));

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
