'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MeasureTool from '../components/MeasureTool';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [shopifyContext, setShopifyContext] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    const host = params.get('host');
    const embedded = params.get('embedded') === '1' || params.get('embedded') === 'true';
    const framed = window.self !== window.top;

    if (shop || host || embedded || framed) {
      setShopifyContext({ shop: shop || 'shopify-store', host });
      setLoading(false);
      return undefined;
    }

    if (params.get('checkout') === 'success') {
      setCheckoutMessage('Payment received - your Pro plan is now active. If it still shows Free, refresh in a few seconds.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancel') {
      setCheckoutMessage('Checkout canceled - you are still on the Free plan.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    let mounted = true;
    const loadingFallback = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2500);

    async function getUser() {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted) setUser(data.user ?? null);
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        window.clearTimeout(loadingFallback);
        if (mounted) setLoading(false);
      }
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => { mounted = false; window.clearTimeout(loadingFallback); subscription.unsubscribe(); };
  }, []);

  async function handleLogOut() {
    await supabase.auth.signOut();
  }

  if (loading && !shopifyContext) {
    return <main><MeasureTool /></main>;
  }

  if (shopifyContext) {
    return (
      <main>
        <ui-title-bar title="Measure Pro">
          <button variant="primary" onClick={() => window.location.reload()}>New photo</button>
        </ui-title-bar>
        <MeasureTool shopifyMode shop={shopifyContext.shop} />
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <MeasureTool />
      </main>
    );
  }

  return (
    <main>
      {checkoutMessage && (
        <div style={{ padding: '10px 20px', background: '#123018', color: '#a5d6a7', fontFamily: 'monospace', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{checkoutMessage}</span>
          <button onClick={() => setCheckoutMessage(null)} style={{ background: 'transparent', border: 'none', color: '#a5d6a7', cursor: 'pointer' }}>x</button>
        </div>
      )}
      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>Logged in as: {user.email}</div>
        <button onClick={handleLogOut}>Log Out</button>
      </div>
      <MeasureTool user={user} />
    </main>
  );
}
