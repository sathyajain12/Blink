import React, { useState } from 'react';
import { X, File, Image as ImageIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const formatTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const FileSidebar = ({ messages, onClose }) => {
  const [preview, setPreview] = useState(null); // { type: 'image'|'file', src, name }
  const [tab, setTab] = useState('all'); // 'all' | 'images' | 'files'

  const imageMessages = messages.filter(m => m.image);
  const fileMessages  = messages.filter(m => m.file);
  const allMedia      = [...imageMessages, ...fileMessages].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const displayed = tab === 'all' ? allMedia : tab === 'images' ? imageMessages : fileMessages;

  const imageList = allMedia.filter(m => m.image);
  const goNext = () => {
    const idx = imageList.findIndex(m => m.image === preview?.src);
    if (idx < imageList.length - 1) setPreview({ type: 'image', src: imageList[idx + 1].image, name: imageList[idx + 1].full_name });
  };
  const goPrev = () => {
    const idx = imageList.findIndex(m => m.image === preview?.src);
    if (idx > 0) setPreview({ type: 'image', src: imageList[idx - 1].image, name: imageList[idx - 1].full_name });
  };

  const tabStyle = (t) => ({
    padding: '0.4rem 0.875rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: tab === t ? 'var(--primary)' : 'transparent',
    color: tab === t ? 'white' : 'var(--text-muted)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      width: '300px', borderLeft: '1px solid var(--border)',
      backgroundColor: 'var(--bg-chat)', display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Channel Files</h3>
        <button onClick={onClose} className="text-muted" style={{ padding: '4px', borderRadius: '6px' }}>
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-sidebar)' }}>
        {['all', 'images', 'files'].map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Image preview lightbox */}
      {preview?.type === 'image' && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setPreview(null)}>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }} style={{ position: 'absolute', left: '1.5rem', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}>
            <ChevronLeft size={24} />
          </button>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '80vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <img src={preview.src} alt="preview" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px', objectFit: 'contain' }} />
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>Shared by {preview.name}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }} style={{ position: 'absolute', right: '1.5rem', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}>
            <ChevronRight size={24} />
          </button>
          <button onClick={() => setPreview(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem', fontSize: '0.875rem' }}>
            No {tab === 'all' ? 'files' : tab} shared in this channel yet.
          </div>
        ) : (
          <>
            {/* Image grid */}
            {(tab === 'all' || tab === 'images') && imageMessages.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                {tab === 'all' && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Images</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {imageMessages.map((m, i) => (
                    <div
                      key={i}
                      onClick={() => setPreview({ type: 'image', src: m.image, name: m.full_name })}
                      style={{
                        aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden',
                        backgroundImage: `url(${m.image})`, backgroundSize: 'cover', backgroundPosition: 'center',
                        cursor: 'pointer', border: '1px solid var(--border)', transition: 'transform 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* File list */}
            {(tab === 'all' || tab === 'files') && fileMessages.length > 0 && (
              <div>
                {tab === 'all' && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Documents</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {fileMessages.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem', borderRadius: '10px',
                      border: '1px solid var(--border)', backgroundColor: '#f8fafc',
                    }}>
                      <div style={{ width: '36px', height: '36px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                        <File size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.file.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.file.size} · {formatTime(m.timestamp)}</div>
                      </div>
                      <button className="text-muted"><Download size={15} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FileSidebar;
