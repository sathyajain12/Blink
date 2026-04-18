import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Hash, MessageSquare, Settings, Search, Plus, LogOut, Sun, Moon, MessageCircle, X, Check, User } from 'lucide-react';
import CreateChannelModal from './CreateChannelModal';

const API = 'https://blinkv2.saisathyajain.workers.dev';

const Sidebar = ({ currentView, currentChannel, channels, dms = [], onSelectChannel, onViewChange, user, theme, onToggleTheme, unreadCounts = {}, onCreateChannel, onCreateDM }) => {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [dmError, setDmError] = useState('');
  const [startingDM, setStartingDM] = useState(null);
  const [profileName, setProfileName] = useState(user.full_name);
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('blink_user');
    localStorage.removeItem('blink_token');
    window.location.reload();
  };

  const openNewDM = async () => {
    setShowNewDM(true);
    setLoadingUsers(true);
    setDmError('');
    const token = localStorage.getItem('blink_token');
    try {
      const res = await fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch {
      setDmError('Could not load users. Please try again.');
    }
    setLoadingUsers(false);
  };

  const startDM = async (otherUser) => {
    setStartingDM(otherUser.id);
    setDmError('');
    try {
      const token = localStorage.getItem('blink_token');
      const res = await fetch(`${API}/api/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: otherUser.id }),
      });
      const dm = await res.json();
      if (res.ok) {
        onCreateDM(dm);
        setShowNewDM(false);
        setDmSearch('');
      } else {
        setDmError(dm.error || 'Failed to open conversation');
      }
    } catch {
      setDmError('Could not connect to server');
    }
    setStartingDM(null);
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    const token = localStorage.getItem('blink_token');
    await fetch(`${API}/api/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ full_name: profileName || undefined, avatar_url: profileAvatar || undefined }),
    });
    setProfileSaving(false);
    setShowProfileEdit(false);
  };

  const filteredUsers = allUsers.filter(u =>
    (u.full_name || '').toLowerCase().includes(dmSearch.toLowerCase())
  );

  const getBadge = (channelId) => {
    const count = unreadCounts[channelId];
    if (!count || currentChannel?.id === channelId) return null;
    return (
      <span style={{
        minWidth: '18px', height: '18px', backgroundColor: 'var(--primary)',
        color: 'white', borderRadius: '9px', fontSize: '0.6875rem',
        fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 4px', marginLeft: 'auto',
      }}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><MessageSquare size={20} fill="white" /></div>
          Blink
        </div>

        <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
          <div className="input-container" style={{ padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
            <Search size={14} className="text-muted" />
            <input type="text" placeholder="Search" style={{ fontSize: '0.8rem', border: 'none', background: 'transparent', color: 'var(--text-main)' }} />
          </div>
        </div>

        <nav className="nav-section">
          <div className="nav-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Channels</span>
            <button onClick={() => setShowCreateChannel(true)} className="text-muted" style={{ padding: '2px' }} title="Create channel">
              <Plus size={14} />
            </button>
          </div>
          {channels.map(ch => (
            <a key={ch.id} href="#"
              className={`nav-item ${currentView === 'chat' && currentChannel?.id === ch.id ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); onSelectChannel(ch); }}
              style={{ justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                <Hash size={16} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
              </span>
              {getBadge(ch.id)}
            </a>
          ))}
        </nav>

        <nav className="nav-section">
          <div className="nav-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Direct Messages</span>
            <button onClick={openNewDM} className="text-muted" style={{ padding: '2px' }} title="New DM">
              <Plus size={14} />
            </button>
          </div>
          {dms.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}>No direct messages yet</p>
          )}
          {dms.map(dm => (
            <a key={dm.id} href="#"
              className={`nav-item ${currentView === 'chat' && currentChannel?.id === dm.id ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); onSelectChannel(dm); }}
              style={{ justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
                  <MessageCircle size={16} />
                  <span style={{
                    position: 'absolute', bottom: -1, right: -1, width: 7, height: 7,
                    borderRadius: '50%', border: '1.5px solid var(--bg-sidebar)',
                    backgroundColor: dm.other_user_status === 'ONLINE' ? '#10b981' : '#94a3b8',
                  }} />
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dm.other_user_name}</span>
              </span>
              {getBadge(dm.id)}
            </a>
          ))}
        </nav>

        {(user.role === 'OWNER' || user.role === 'ADMIN') && (
          <nav className="nav-section">
            <a href="#"
              className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
              onClick={e => { e.preventDefault(); onViewChange('admin'); }}
            >
              <Settings size={18} />
              Admin Panel
            </a>
          </nav>
        )}

        <div className="user-profile" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setShowProfileEdit(true)} style={{ position: 'relative', flexShrink: 0, background: 'none', padding: 0 }} title="Edit profile">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
            ) : (
              <div className="avatar" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, backgroundColor: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-sidebar)' }} />
              </div>
            )}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Online</div>
          </div>
          <button onClick={onToggleTheme} className="text-muted" title="Toggle theme" style={{ flexShrink: 0 }}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={handleLogout} className="text-muted" title="Logout" style={{ flexShrink: 0 }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreated={onCreateChannel}
        />
      )}

      {showNewDM && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="fade-in" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-chat)', borderRadius: '20px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700 }}>New Direct Message</h3>
              <button onClick={() => { setShowNewDM(false); setDmSearch(''); setDmError(''); }} className="text-muted"><X size={18} /></button>
            </div>
            <input
              type="text" placeholder="Search people…"
              value={dmSearch} onChange={e => setDmSearch(e.target.value)}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.625rem 0.875rem', fontSize: '0.875rem', marginBottom: '0.75rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
              autoFocus
            />
            {dmError && (
              <p style={{ fontSize: '0.8125rem', color: '#ef4444', marginBottom: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                {dmError}
              </p>
            )}
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {loadingUsers && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Loading…</p>}
              {filteredUsers.map(u => (
                <button key={u.id} onClick={() => startDM(u)}
                  disabled={startingDM === u.id}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.5rem', borderRadius: '8px', background: 'none', textAlign: 'left', opacity: startingDM && startingDM !== u.id ? 0.5 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} style={{ color: 'var(--primary)' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: u.status === 'ONLINE' ? '#10b981' : 'var(--text-muted)' }}>{u.status || 'Offline'}</div>
                  </div>
                  {startingDM === u.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Opening…</span>}
                </button>
              ))}
              {!loadingUsers && filteredUsers.length === 0 && !dmError && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.875rem' }}>
                  {allUsers.length === 0 ? 'No other users in the workspace yet' : 'No users match your search'}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showProfileEdit && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="fade-in" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-chat)', borderRadius: '20px', padding: '2rem', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700 }}>Edit Profile</h3>
              <button onClick={() => setShowProfileEdit(false)} className="text-muted"><X size={18} /></button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>DISPLAY NAME</label>
              <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.625rem 0.875rem', fontSize: '0.9375rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>AVATAR URL</label>
              <input type="text" value={profileAvatar} onChange={e => setProfileAvatar(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.625rem 0.875rem', fontSize: '0.9375rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowProfileEdit(false)} style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9375rem', color: 'var(--text-muted)', backgroundColor: 'transparent' }}>Cancel</button>
              <button onClick={saveProfile} disabled={profileSaving}
                style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.9375rem', fontWeight: 600, opacity: profileSaving ? 0.6 : 1 }}>
                {profileSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Sidebar;
