'use client';

import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';

export default function InfoGuide({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        style={{ 
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32,
          borderRadius: '50%', 
          color: 'var(--primary)', 
          background: 'rgba(79, 70, 229, 0.1)',
          border: '1px solid rgba(79, 70, 229, 0.2)',
          marginLeft: 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
          verticalAlign: 'middle'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(79, 70, 229, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="How to use this page"
        aria-label="Info guide"
      >
        <Info size={16} strokeWidth={2.5} />
      </button>

      {open && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            padding: 20
          }}
          onClick={() => setOpen(false)}
        >
          <style>{`
            @keyframes infoModalIn {
              from { opacity: 0; transform: translateY(15px) scale(0.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          
          <div 
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              width: '100%', maxWidth: 540,
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              animation: 'infoModalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: '1px solid var(--border)', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              background: 'linear-gradient(to right, rgba(79, 70, 229, 0.05), transparent)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
                <div style={{ background: 'var(--primary)', color: '#fff', padding: 6, borderRadius: 8, display: 'flex' }}>
                  <Info size={20} strokeWidth={2.5} />
                </div>
                {title}
              </div>
              <button 
                onClick={() => setOpen(false)} 
                className="btn btn-ghost" 
                style={{ padding: 6, margin: -6, borderRadius: '50%' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ 
              padding: '24px', 
              fontSize: 14, 
              color: 'var(--text-secondary)', 
              lineHeight: 1.6, 
              maxHeight: 'calc(100vh - 200px)', 
              overflowY: 'auto' 
            }}>
              {children}
            </div>

            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid var(--border)', 
              background: 'var(--surface-alt)', 
              textAlign: 'right' 
            }}>
              <button 
                onClick={() => setOpen(false)} 
                className="btn btn-primary"
                style={{ padding: '8px 24px', fontWeight: 600 }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
