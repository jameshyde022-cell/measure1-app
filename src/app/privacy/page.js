export const metadata = {
  title: 'Privacy Policy - Measure Pro',
};

const S = {
  page: { background: '#0d0d0d', color: '#f0ebe0', minHeight: '100vh', fontFamily: 'monospace', padding: '48px 24px' },
  wrap: { maxWidth: 720, margin: '0 auto' },
  h1: { fontFamily: "'Playfair Display', serif", fontSize: 30, color: '#e8b84b', marginBottom: 4 },
  updated: { fontSize: 12, color: '#999', marginBottom: 32 },
  h2: { fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#e8b84b', marginTop: 32, marginBottom: 10 },
  p: { fontSize: 13, lineHeight: 1.7, color: '#d6d0c4', marginBottom: 12 },
  ul: { fontSize: 13, lineHeight: 1.7, color: '#d6d0c4', paddingLeft: 20, marginBottom: 12 },
  a: { color: '#7dd3fc' },
};

export default function PrivacyPolicy() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={S.updated}>Last updated: July 31, 2026</p>

        <p style={S.p}>
          Measure Pro (&quot;we&quot;, &quot;us&quot;) provides a garment photo editing and measurement
          annotation tool, available as a Shopify app and at measureapp.pro. This policy explains
          what data we collect and how we use it.
        </p>

        <h2 style={S.h2}>What we collect</h2>
        <ul style={S.ul}>
          <li><strong>Account data (web users):</strong> email address, via Supabase Auth, when you create an account.</li>
          <li><strong>Shopify merchant data:</strong> your store domain and an OAuth access token, so the app can operate on your store. We do not request or receive access to your customers&apos; personal data, orders, or checkout information.</li>
          <li><strong>Billing status:</strong> subscription plan and usage counts (for enforcing plan limits), via Stripe (web) or Shopify Billing (merchants). We never see or store your card number &mdash; Stripe and Shopify handle payment details directly.</li>
          <li><strong>Garment photos:</strong> images you upload or select are sent to Google Gemini and/or PhotoRoom to generate edited product photos. We do not store your photos on our servers; processing is transient. Your finished images and measurement drafts are saved only in your own browser&apos;s local storage, never on our servers.</li>
        </ul>

        <h2 style={S.h2}>How we use it</h2>
        <p style={S.p}>
          To operate the core features of the app (image processing, measurement tools, exports),
          to enforce plan limits and process billing, and to provide support if you contact us.
          We do not sell your data or use it for advertising.
        </p>

        <h2 style={S.h2}>Third parties we use</h2>
        <ul style={S.ul}>
          <li>Google Gemini API &mdash; image generation/editing</li>
          <li>PhotoRoom API &mdash; background removal</li>
          <li>Supabase &mdash; account authentication and database storage</li>
          <li>Stripe &mdash; payment processing (web)</li>
          <li>Shopify Billing &mdash; payment processing (Shopify merchants)</li>
          <li>Vercel &mdash; application hosting</li>
        </ul>
        <p style={S.p}>Each of these providers processes data under their own privacy policy.</p>

        <h2 style={S.h2}>Data retention &amp; deletion</h2>
        <p style={S.p}>
          If you uninstall the app from your Shopify store, we delete our stored record of your
          shop (access token and billing status) within 48 hours. Web account data is retained
          until you request deletion by contacting us.
        </p>

        <h2 style={S.h2}>Contact</h2>
        <p style={S.p}>
          Questions about this policy or your data: <a style={S.a} href="mailto:jameshyde022@gmail.com">jameshyde022@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
