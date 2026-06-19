'use client';

import { useEffect, useState } from 'react';

export default function SetupBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if Firebase is configured by looking for the env var
    const hasConfig = Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your_api_key_here'
    );
    setShow(!hasConfig);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(135deg, #1a1f2c, #21262d)',
      borderTop: '1px solid #F0B429',
      padding: '16px 32px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ color: '#F0B429', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          ⚙️ Firebase not configured
        </div>
        <div style={{ color: '#8B949E', fontSize: 12 }}>
          Create a <code style={{ background: '#0D1117', padding: '1px 6px', borderRadius: 4, color: '#58A6FF' }}>.env.local</code> file from{' '}
          <code style={{ background: '#0D1117', padding: '1px 6px', borderRadius: 4, color: '#58A6FF' }}>.env.local.example</code> and add your Firebase credentials.
          See <a href="/SETUP.md" style={{ color: '#58A6FF' }}>SETUP.md</a> for instructions.
        </div>
      </div>
    </div>
  );
}
