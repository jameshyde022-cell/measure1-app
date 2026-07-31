import { NextResponse } from 'next/server';
import { verifyShopifyWebhookHmac } from '../../../../../lib/shopify';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(request) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  const topic = request.headers.get('x-shopify-topic');
  const payload = JSON.parse(rawBody);

  // customers/data_request and customers/redact: this app never stores
  // Shopify customer/order data (only product images and shop-level
  // billing state), so there is nothing to compile or erase for either.
  if (topic === 'shop/redact') {
    const shop = payload?.shop_domain;
    if (shop) {
      const { error } = await supabaseAdmin.from('shopify_shops').delete().eq('shop', shop);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
