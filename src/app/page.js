'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getShopifySessionToken } from '../lib/shopifyClient';
import MeasureTool from '../components/MeasureTool';

function detectShopifyEmbed() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get('embedded') === '1' || params.get('embedded') === 'true';
  return Boolean(params.get('shop') || params.get('host') || embedded || window.self !== window.top);
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [shopifyContext, setShopifyContext] = useState(null);
  const [shopifyAuthError, setShopifyAuthError] = useState(null);
  const [isShopifyEmbed] = useState(detectShopifyEmbed);

  useEffect(() => {
    if (isShopifyEmbed) {
      const params = new URLSearchParams(window.location.search);
      const host = params.get('host');
      let cancelled = false;

      (async () => {
        const token = await getShopifySessionToken();
        if (cancelled) return;

        if (!token) {
          setShopifyAuthError('Could not verify your Shopify session. Please reload the app from your Shopify admin.');
          return;
        }

        try {
          const res = await fetch('/api/shopify/session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;

          if (!res.ok || !data.ok) {
            setShopifyAuthError(data.error || 'Could not authenticate with Shopify.');
            return;
          }

          setShopifyContext({ shop: data.shop, host });
        } catch (error) {
          if (!cancelled) setShopifyAuthError('Could not authenticate with Shopify.');
        }
      })();

      return () => { cancelled = true; };
    }

    const params = new URLSearchParams(window.location.search);
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

  if (isShopifyEmbed) {
    if (shopifyAuthError) {
      return (
        <main style={{ padding: '24px 20px', fontFamily: 'monospace', color: '#f0ebe0' }}>
          <p>{shopifyAuthError}</p>
        </main>
      );
    }

    if (!shopifyContext) {
      return (
        <main style={{ padding: '24px 20px', fontFamily: 'monospace', color: '#f0ebe0' }}>
          <p>Loading...</p>
        </main>
      );
    }

    return (
      <main>
        <ui-title-bar title="Measure Pro">
          <button variant="primary" onClick={() => window.location.reload()}>New photo</button>
        </ui-title-bar>
        <MeasureTool shopifyMode shop={shopifyContext.shop} />
      </main>
    );
  }

  if (loading && !shopifyContext) {
    return <main><MeasureTool /></main>;
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
