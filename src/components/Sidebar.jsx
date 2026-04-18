import React from 'react';
import { Hash, MessageSquare, Settings, Search, Plus, LogOut } from 'lucide-react';

const Sidebar = ({ currentView, currentChannel, channels, onSelectChannel, onViewChange, user }) => {
  const handleLogout = () => {
    localStorage.removeItem('blink_user');
    localStorage.removeItem('blink_token');
    window.location.reload();
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <MessageSquare size={20} fill="white" />
        </div>
        Blink
      </div>

      <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="input-container" style={{ padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
          <Search size={14} className="text-muted" />
          <input
            type="text"
            placeholder="Search"
            style={{ fontSize: '0.8rem', border: 'none', background: 'transparent' }}
          />
        </div>
      </div>

      <nav className="nav-section">
        <div className="nav-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Channels</span>
          <Plus size={14} />
        </div>
        {channels.map(ch => (
          <a
            key={ch.id}
            href="#"
            className={`nav-item ${currentView === 'chat' && currentChannel?.id === ch.id ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); onSelectChannel(ch); }}
          >
            <Hash size={16} />
            {ch.name}
          </a>
        ))}
      </nav>

      {(user.role === 'OWNER' || user.role === 'ADMIN') && (
        <nav className="nav-section" style={{ marginTop: 'auto' }}>
          <a
            href="#"
            className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); onViewChange('admin'); }}
          >
            <Settings size={18} />
            Admin Panel
          </a>
        </nav>
      )}

      <div className="user-profile" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem 0',
        borderTop: '1px solid var(--border)'
      }}>
        <div className="avatar" style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: '10px',
            height: '10px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            border: '2px solid var(--bg-sidebar)'
          }}></div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.full_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Online</div>
        </div>
        <button onClick={handleLogout} className="text-muted" title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
