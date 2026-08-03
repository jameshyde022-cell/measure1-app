export async function getShopifySessionToken() {
  if (typeof window === 'undefined' || !window.shopify?.idToken) return null;
  try {
    return await window.shopify.idToken();
  } catch {
    return null;
  }
}
