import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash } from 'lucide-react';

const API = 'https://blinkv2.saisathyajain.workers.dev';

const CreateChannelModal = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Channel name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('blink_token');
      const res = await fetch(`${API}/api/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create channel'); return; }
      onCreated(data);
      onClose();
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--bg-chat)', borderRadius: '20px', padding: '2rem', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create a channel</h2>
          <button onClick={onClose} className="text-muted"><X size={20} /></button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            CHANNEL NAME
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.625rem 0.875rem', backgroundColor: 'var(--bg-main)' }}>
            <Hash size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="e.g. announcements"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.9375rem', color: 'var(--text-main)' }}
              autoFocus
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            DESCRIPTION <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            placeholder="What's this channel about?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.625rem 0.875rem', fontSize: '0.9375rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
          />
        </div>

        {error && <p style={{ fontSize: '0.875rem', color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9375rem', color: 'var(--text-muted)', backgroundColor: 'transparent' }}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.9375rem', fontWeight: 600, opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            {loading ? 'Creating…' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateChannelModal;
