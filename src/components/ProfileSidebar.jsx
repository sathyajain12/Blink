import React from 'react';
import { X, MessageSquare, Files, ExternalLink } from 'lucide-react';

const ProfileSidebar = ({ user, onClose }) => {
  if (!user) return null;

  const sharedFiles = [
    { id: 1, type: 'image', url: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=200&auto=format&fit=crop' },
    { id: 2, type: 'image', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=200&auto=format&fit=crop' },
    { id: 3, type: 'file', name: 'Notes' }
  ];

  return (
    <div style={{ 
        width: '320px', 
        borderLeft: '1px solid var(--border)', 
        backgroundColor: 'var(--bg-chat)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
    }}>
      <div style={{ height: '140px', backgroundColor: 'var(--primary)', position: 'relative' }}>
          <button 
            onClick={onClose} 
            style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'white', backgroundColor: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '50%' }}
          >
              <X size={16} />
          </button>
      </div>

      <div style={{ padding: '0 1.5rem', marginTop: '-48px', textAlign: 'center' }}>
          <div style={{ 
              width: '96px', 
              height: '96px', 
              borderRadius: '50%', 
              border: '4px solid white', 
              backgroundColor: '#e2e8f0', 
              margin: '0 auto 1rem',
              position: 'relative',
              backgroundImage: 'url(https://randomuser.me/api/portraits/women/44.jpg)',
              backgroundSize: 'cover'
          }}>
              <div style={{ 
                  position: 'absolute', 
                  bottom: '6px', 
                  right: '6px', 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: '#f59e0b', 
                  borderRadius: '50%', 
                  border: '2px solid white' 
              }}></div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{user.name || 'Priya Sharma'}</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>@{user.username || 'priya.sharma'}</p>
          
          <div style={{ 
              display: 'inline-block', 
              fontSize: '0.625rem', 
              fontWeight: 700, 
              backgroundColor: '#f3f4f6', 
              padding: '2px 8px', 
              borderRadius: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
          }}>
              <span style={{ color: '#f59e0b', marginRight: '4px' }}>●</span> IN A MEETING
          </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <button style={{ flex: 1, padding: '0.625rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem' }}>Message</button>
          <button style={{ flex: 1, padding: '0.625rem', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem' }}>View Files</button>
      </div>

      <div style={{ padding: '0 1.5rem 1.5rem', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Department</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Product Design</div>
              </div>
              <div>
                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Local Time</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>2:14 PM IST</div>
              </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Email</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)' }}>priya.s@office.com</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Shared Files</h4>
              <button style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>View All</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {sharedFiles.map(file => (
                  <div key={file.id} style={{ 
                      aspectRatio: '1/1', 
                      borderRadius: '8px', 
                      backgroundColor: 'var(--primary-light)', 
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundImage: file.type === 'image' ? `url(${file.url})` : 'none',
                      backgroundSize: 'cover'
                  }}>
                      {file.type === 'file' && <Files size={24} className="text-muted" />}
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default ProfileSidebar;
