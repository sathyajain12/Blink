import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Image as ImageIcon,
  AtSign,
  Smile,
  Send,
  Search,
  Users,
  Pin,
  Info,
  Download,
  Hash,
  File
} from 'lucide-react';

import FileModal from './FileModal';
import ProfileSidebar from './ProfileSidebar';

const API = 'https://blinkv2.saisathyajain.workers.dev';
const WS_URL = 'wss://blinkv2.saisathyajain.workers.dev';

const formatTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatArea = ({ channel, user }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeouts = useRef({});

  useEffect(() => {
    if (!channel) return;

    setMessages([]);

    // Fetch message history
    const token = localStorage.getItem('blink_token');
    fetch(`${API}/api/messages/${channel.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});

    // Connect WebSocket
    const socket = new WebSocket(`${WS_URL}/api/ws?room=${channel.id}`);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', channelId: channel.id }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          setTypingUsers(prev => { const n = { ...prev }; delete n[data.message.user_id]; return n; });
          setMessages(prev => [...prev, data.message]);
        }
        if (data.type === 'typing') {
          setTypingUsers(prev => ({ ...prev, [data.userId]: data.userName }));
          clearTimeout(typingTimeouts.current[data.userId]);
          typingTimeouts.current[data.userId] = setTimeout(() => {
            setTypingUsers(prev => { const n = { ...prev }; delete n[data.userId]; return n; });
          }, 3000);
        }
      } catch {}
    };

    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [channel]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'message',
      channelId: channel.id,
      userId: user.id,
      userName: user.full_name,
      content: inputText.trim(),
    }));

    setInputText('');
  };

  const handleFileSend = ({ file, caption }) => {
    const newMessage = {
      id: Date.now().toString(),
      user_id: user.id,
      full_name: user.full_name,
      content: caption || '',
      file: { name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` },
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const openProfile = (u) => {
    setProfileUser(u);
    setShowProfile(true);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Hash size={20} className="text-muted" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{channel.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }} className="text-muted">
            <Search size={18} />
            <button onClick={() => openProfile(null)} className="text-muted" style={{ display: 'flex', alignItems: 'center' }}>
              <Users size={18} />
            </button>
            <Pin size={18} />
            <Info size={18} />
          </div>
        </header>

        <div className="chat-area" ref={scrollRef}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.9rem' }}>
              No messages yet. Be the first to say something in #{channel.name}!
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="message fade-in">
              <div
                className="avatar"
                style={{ cursor: 'pointer' }}
                onClick={() => openProfile({ name: msg.full_name, id: msg.user_id })}
              ></div>
              <div className="message-content">
                <div className="message-header">
                  <span
                    className="user-name"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openProfile({ name: msg.full_name, id: msg.user_id })}
                  >
                    {msg.full_name}
                  </span>
                  <span className="timestamp">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="text">{msg.content}</div>

                {msg.file && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '1rem',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    maxWidth: '400px',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{
                      width: '40px', height: '40px',
                      backgroundColor: 'var(--primary-light)',
                      borderRadius: '8px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary)'
                    }}>
                      <File size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{msg.file.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{msg.file.size}</div>
                    </div>
                    <Download size={18} className="text-muted" />
                  </div>
                )}

                {msg.image && (
                  <img src={msg.image} alt="attachment" style={{
                    maxWidth: '100%', maxHeight: '400px',
                    borderRadius: '12px', marginTop: '1rem',
                    border: '1px solid var(--border)'
                  }} />
                )}
              </div>
            </div>
          ))}
        </div>

        {Object.keys(typingUsers).length > 0 && (
          <div style={{ padding: '0 1.5rem 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing</span>
            <span style={{ display: 'inline-flex', gap: '3px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  backgroundColor: 'var(--text-muted)',
                  display: 'inline-block',
                  animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </span>
          </div>
        )}

        <div className="input-area">
          <div className="input-container" style={{ border: '1px solid var(--border)', padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }} className="text-muted">
              <button className="text-muted" onClick={() => setIsModalOpen(true)}>
                <Paperclip size={20} />
              </button>
              <button className="text-muted"><ImageIcon size={20} /></button>
              <button className="text-muted"><AtSign size={20} /></button>
              <button className="text-muted"><Smile size={20} /></button>
            </div>
            <textarea
              className="message-input"
              placeholder={`Message #${channel.name}...`}
              value={inputText}
              onChange={(e) => {
              setInputText(e.target.value);
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'typing',
                  channelId: channel.id,
                  userId: user.id,
                  userName: user.full_name,
                }));
              }
            }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!inputText.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {showProfile && (
        <ProfileSidebar
          user={profileUser}
          onClose={() => setShowProfile(false)}
        />
      )}

      <FileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSend={handleFileSend}
      />
    </div>
  );
};

export default ChatArea;
