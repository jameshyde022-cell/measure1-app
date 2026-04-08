'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MeasureTool from '../components/MeasureTool';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      setLoading(false);
    }

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <main style={{ padding: '40px', maxWidth: '700px', margin: '0 auto' }}>
        <h1>Measure</h1>
        <p>You need to log in before using exports.</p>
        <a href="/login" style={{ display: 'inline-block', marginTop: '20px' }}>
          Go to Login
        </a>
        <div style={{ marginTop: '30px' }}>
          <MeasureTool />
        </div>
      </main>
    );
  }

  return (
    <main>
      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>Logged in as: {user.email}</div>
        <button onClick={handleLogOut}>Log Out</button>
      </div>
      <MeasureTool user={user} />
    </main>
  );
}