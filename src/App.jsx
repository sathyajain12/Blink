import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';

const API = 'https://blinkv2.saisathyajain.workers.dev';

const App = () => {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [currentChannel, setCurrentChannel] = useState(null);
  const [channels, setChannels] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('blink_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('blink_theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedUser = localStorage.getItem('blink_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('blink_token');
    fetch(`${API}/api/channels`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChannels(data);
          setCurrentChannel(data[0]);
        }
      })
      .catch(() => {});
  }, [user]);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        currentView={currentView}
        currentChannel={currentChannel}
        channels={channels}
        onSelectChannel={(ch) => {
          setCurrentChannel(ch);
          setCurrentView('chat');
        }}
        onViewChange={setCurrentView}
        user={user}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      />
      <main className="main-content">
        {currentView === 'chat' && currentChannel ? (
          <ChatArea channel={currentChannel} user={user} />
        ) : currentView === 'admin' && (user.role === 'OWNER' || user.role === 'ADMIN') ? (
          <AdminPanel />
        ) : null}
      </main>
    </div>
  );
};

export default App;
