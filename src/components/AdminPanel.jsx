import React, { useState, useEffect } from 'react';
import {
  Users, Zap, Send, Upload, Search, Filter, Download, MinusCircle
} from 'lucide-react';

const API = 'https://blinkv2.saisathyajain.workers.dev';

const formatTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusColor = (status) => {
  if (!status) return '#94a3b8';
  if (status.toUpperCase() === 'ONLINE') return '#10b981';
  if (status.toUpperCase() === 'AWAY') return '#f59e0b';
  return '#94a3b8';
};

const AdminPanel = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    const token = localStorage.getItem('blink_token');
    await fetch(`${API}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  useEffect(() => {
    const token = localStorage.getItem('blink_token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/api/admin`, { headers }).then(r => r.json()),
      fetch(`${API}/api/admin/users`, { headers }).then(r => r.json()),
    ])
      .then(([adminData, usersData]) => {
        if (adminData.stats) setStats(adminData.stats);
        if (adminData.activities) setActivities(adminData.activities);
        if (Array.isArray(usersData)) setUsers(usersData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers ?? 0, change: null, icon: Users, color: '#f5f3ff', iconColor: '#7c3aed' },
    { label: 'Active Today', value: stats.activeToday ?? 0, change: null, icon: Zap, color: '#eff6ff', iconColor: '#2563eb' },
    { label: 'Messages Sent', value: stats.totalMessages ?? 0, change: null, icon: Send, color: '#fff7ed', iconColor: '#ea580c' },
    { label: 'Files Uploaded', value: stats.filesUploaded ?? 0, change: null, icon: Upload, color: '#f8fafc', iconColor: '#64748b' },
  ] : [];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Admin Panel</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Manage users and workspace</p>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '0.625rem 1rem 0.625rem 2.75rem',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              width: '300px',
              fontSize: '0.875rem'
            }}
          />
        </div>
      </header>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        {statCards.map((stat, i) => (
          <div key={i} style={{ backgroundColor: 'var(--bg-chat)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: stat.color, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.iconColor }}>
                <stat.icon size={20} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stat.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* User Directory */}
        <div style={{ backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700 }}>User Directory</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="text-muted" style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '8px' }}><Filter size={16} /></button>
              <button className="text-muted" style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '8px' }}><Download size={16} /></button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-sidebar)' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Active</th>
                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {search ? 'No users match your search.' : 'No users yet.'}
                  </td>
                </tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ width: '32px', height: '32px', borderRadius: '8px' }}></div>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700,
                      padding: '2px 8px', borderRadius: '6px',
                      backgroundColor: '#eef2ff', color: '#4f46e5',
                      border: '1px solid #e0e7ff'
                    }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor(u.status) }}></div>
                      {u.status || 'OFFLINE'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {u.last_active ? formatTime(u.last_active) : 'Never'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.full_name)}
                      title="Delete user"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                    >
                      <MinusCircle size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {/* Activity Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Recent Activity</h3>
            {activities.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No activity yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activities.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4f46e5', marginTop: '6px', flexShrink: 0 }}></div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {a.full_name || 'System'}{' '}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{a.details}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {formatTime(a.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: 'var(--primary)', color: 'white', borderRadius: '16px', padding: '1.5rem', backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Workspace Health</h3>
            <p style={{ fontSize: '0.8125rem', opacity: 0.8 }}>
              {users.length} registered users · {stats?.totalMessages ?? 0} messages sent
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
