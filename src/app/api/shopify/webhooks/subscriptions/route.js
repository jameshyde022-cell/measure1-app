import { NextResponse } from 'next/server';
import { verifyShopifyWebhookHmac } from '../../../../../lib/shopify';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(request) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const { apiSecret } = { apiSecret: process.env.SHOPIFY_API_SECRET };

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, apiSecret)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  const shop = request.headers.get('x-shopify-shop-domain');
  const payload = JSON.parse(rawBody);
  const status = payload?.app_subscription?.status;

  if (shop && status) {
    const plan = status === 'ACTIVE' ? 'active' : 'cancelled';
    const { error } = await supabaseAdmin
      .from('shopify_shops')
      .update({ plan })
      .eq('shop', shop);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
