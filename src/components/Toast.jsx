import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash, MessageCircle } from 'lucide-react';

const TOAST_DURATION = 4000;

const ToastItem = ({ toast, onDismiss, onNavigate }) => {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), TOAST_DURATION);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      onClick={() => { onNavigate(toast.channel); onDismiss(toast.id); }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
        padding: '0.75rem 1rem', borderRadius: '12px',
        backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        cursor: 'pointer', minWidth: '260px', maxWidth: '340px',
        animation: 'fadeIn 0.25s ease-out forwards',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        backgroundColor: 'var(--primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {toast.channel.type === 'DM'
          ? <MessageCircle size={16} style={{ color: 'var(--primary)' }} />
          : <Hash size={16} style={{ color: 'var(--primary)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
          {toast.channel.type === 'DM' ? toast.channel.other_user_name : `#${toast.channel.name}`}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {toast.senderName ? `${toast.senderName}: ${toast.preview}` : toast.preview}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss(toast.id); }}
        style={{ flexShrink: 0, color: 'var(--text-muted)', padding: '2px' }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, onDismiss, onNavigate }) => {
  if (!toasts.length) return null;
  return createPortal(
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      zIndex: 9999,
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onNavigate={onNavigate} />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
