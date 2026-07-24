'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleGoogleLogIn() {
    setMessage('Redirecting to Google...');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function handleSignUp() {
    setMessage('Creating account...');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

  
    setMessage('Account created. Check your email if Supabase asks you to confirm.');
  }

  async function handleLogIn() {
    setMessage('Logging in...');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Logged in successfully.');
    router.push('/');
    router.refresh();
  }

  return (
    <main style={{ padding: '40px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Login</h1>

      <div style={{ display: 'grid', gap: '12px', marginTop: '20px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '12px', fontSize: '16px' }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '12px', fontSize: '16px' }}
        />

        <button onClick={handleSignUp} style={{ padding: '12px', fontSize: '16px' }}>
          Sign Up
        </button>

        <button onClick={handleLogIn} style={{ padding: '12px', fontSize: '16px' }}>
          Log In
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#888' }}>
          <div style={{ flex: 1, height: '1px', background: '#ccc' }} />
          <span style={{ fontSize: '13px' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#ccc' }} />
        </div>

        <button
          onClick={handleGoogleLogIn}
          style={{
            padding: '12px',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        {message && <p>{message}</p>}
      </div>
    </main>
  );
}