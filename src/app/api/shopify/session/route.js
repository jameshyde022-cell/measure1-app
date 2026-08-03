import { NextResponse } from 'next/server';
import { verifySessionToken, exchangeSessionTokenForAccessToken, persistShopToken } from '../../../../lib/shopify';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const shop = verifySessionToken(authHeader);

  if (!shop) {
    return NextResponse.json({ error: 'Invalid session token.' }, { status: 401 });
  }

  const sessionToken = authHeader.slice(7);

  try {
    const tokenData = await exchangeSessionTokenForAccessToken({ shop, sessionToken });
    await persistShopToken({ shop, tokenData });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Token exchange failed.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, shop });
}
