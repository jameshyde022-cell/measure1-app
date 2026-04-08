'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function ensureProfile(user) {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!existingProfile) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        plan: 'free',
        export_count_today: 0,
        export_count_date: null,
      });

      if (insertError) {
        throw insertError;
      }
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

    if (data.user) {
      try {
        await ensureProfile(data.user);
      } catch (profileError) {
        setMessage(profileError.message);
        return;
      }
    }

    setMessage('Account created. Check your email if Supabase asks you to confirm.');
  }

  async function handleLogIn() {
    setMessage('Logging in...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user) {
      try {
        await ensureProfile(data.user);
      } catch (profileError) {
        setMessage(profileError.message);
        return;
      }
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

        {message && <p>{message}</p>}
      </div>
    </main>
  );
}