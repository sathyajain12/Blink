import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  Paperclip, Image as ImageIcon, AtSign, Smile, Send, Search, Users,
  FolderOpen, Hash, File, Download, Pin, PinOff, Reply, Edit2, Trash2,
  X, Check, ChevronDown, MessageCircle,
} from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import FileModal from './FileModal';
import ProfileSidebar from './ProfileSidebar';
import FileSidebar from './FileSidebar';

const API = 'https://blinkv2.saisathyajain.workers.dev';
const WS_URL = 'wss://blinkv2.saisathyajain.workers.dev';
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

// ── Markdown + emoji renderer ─────────────────────────────────────────────

function parseMarkdown(text) {
  if (!text) return '';
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Protect code blocks
  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
    const i = blocks.length;
    blocks.push(`<pre class="md-pre"><code>${code.trim()}</code></pre>`);
    return `\x00B${i}\x00`;
  });

  // Protect inline code
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    const i = codes.length;
    codes.push(`<code class="md-code">${c}</code>`);
    return `\x00C${i}\x00`;
  });

  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  s = s.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');
  s = s.replace(EMOJI_REGEX, '<span class="emoji-animated">$&</span>');
  s = s.replace(/\n/g, '<br>');

  codes.forEach((c, i) => { s = s.replace(`\x00C${i}\x00`, c); });
  blocks.forEach((b, i) => { s = s.replace(`\x00B${i}\x00`, b); });
  return s;
}

function isEmojiOnly(text) {
  return !!text && text.replace(EMOJI_REGEX, '').trim() === '';
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFull(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function groupReactions(reactions = []) {
  const map = {};
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = [];
    map[r.emoji].push(r.user_id);
  }
  return Object.entries(map).map(([emoji, userIds]) => ({ emoji, userIds }));
}

// ── MessageItem ───────────────────────────────────────────────────────────

const MessageItem = memo(({ msg, currentUser, isAdmin, onReply, onToggleReaction, onEdit, onDelete, onPin, onUnpin, isPinned, onAvatarClick }) => {
  const [hovered, setHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const pickerRef = useRef(null);

  const isOwn = msg.user_id === currentUser.id;
  const grouped = useMemo(() => groupReactions(msg.reactions), [msg.reactions]);
  const emojiOnly = isEmojiOnly(msg.content);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowReactionPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent.trim() !== msg.content) onEdit(msg.id, editContent.trim());
    setIsEditing(false);
  };

  if (msg.is_deleted) {
    return (
      <div className="message">
        <div className="avatar" />
        <div className="message-content">
          <div className="message-header">
            <span className="user-name">{msg.full_name}</span>
            <span className="timestamp" title={formatFull(msg.timestamp)}>{formatTime(msg.timestamp)}</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>This message was deleted.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="message"
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowReactionPicker(false); }}
    >
      {hovered && (
        <div className="message-actions">
          {QUICK_REACTIONS.map(emoji => (
            <button key={emoji} className="action-btn reaction-quick" onClick={() => onToggleReaction(msg.id, emoji)} title={emoji}>
              {emoji}
            </button>
          ))}
          <div style={{ width: 1, height: 18, backgroundColor: 'var(--border)', margin: '0 2px' }} />
          <div style={{ position: 'relative' }} ref={pickerRef}>
            <button className="action-btn" onClick={() => setShowReactionPicker(p => !p)} title="React">
              <Smile size={14} />
            </button>
            {showReactionPicker && (
              <div style={{ position: 'absolute', bottom: '2rem', right: 0, zIndex: 200 }}>
                <Picker data={data} onEmojiSelect={e => { onToggleReaction(msg.id, e.native); setShowReactionPicker(false); }} theme="light" previewPosition="none" skinTonePosition="none" />
              </div>
            )}
          </div>
          <button className="action-btn" onClick={() => onReply(msg)} title="Reply"><Reply size={14} /></button>
          {isOwn && <button className="action-btn" onClick={() => { setIsEditing(true); setEditContent(msg.content); }} title="Edit"><Edit2 size={14} /></button>}
          {(isOwn || isAdmin) && <button className="action-btn danger" onClick={() => onDelete(msg.id)} title="Delete"><Trash2 size={14} /></button>}
          {isAdmin && (
            <button className="action-btn" onClick={() => isPinned ? onUnpin(msg.id) : onPin(msg.id)} title={isPinned ? 'Unpin' : 'Pin'}>
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
        </div>
      )}

      {msg.avatar_url ? (
        <img src={msg.avatar_url} alt="" onClick={() => onAvatarClick({ name: msg.full_name, id: msg.user_id })}
          style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} />
      ) : (
        <div className="avatar" style={{ cursor: 'pointer' }} onClick={() => onAvatarClick({ name: msg.full_name, id: msg.user_id })} />
      )}

      <div className="message-content">
        <div className="message-header">
          <span className="user-name" style={{ cursor: 'pointer' }} onClick={() => onAvatarClick({ name: msg.full_name, id: msg.user_id })}>
            {msg.full_name}
          </span>
          <span className="timestamp" title={formatFull(msg.timestamp)}>{formatTime(msg.timestamp)}</span>
          {msg.edited_at && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>(edited)</span>}
          {isPinned && <span title="Pinned"><Pin size={11} style={{ color: 'var(--primary)', marginLeft: 2 }} /></span>}
        </div>

        {msg.reply_to_id && (
          <div className="reply-context">
            <div style={{ width: 3, backgroundColor: 'var(--primary)', borderRadius: 2, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 1 }}>{msg.reply_user_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.reply_content}</div>
            </div>
          </div>
        )}

        {isEditing ? (
          <div style={{ marginTop: '0.25rem' }}>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } if (e.key === 'Escape') setIsEditing(false); }}
              style={{ width: '100%', border: '1px solid var(--primary)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.9375rem', resize: 'none', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontFamily: 'inherit' }}
              rows={2}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button onClick={handleSaveEdit} style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600 }}>Save</button>
              <button onClick={() => setIsEditing(false)} style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-muted)', backgroundColor: 'transparent' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={`text ${emojiOnly ? 'emoji-only' : ''}`} dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
        )}

        {msg.file && (
          <div style={{ marginTop: '0.75rem', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '400px', border: '1px solid var(--border)' }}>
            <div style={{ width: 40, height: 40, backgroundColor: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
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
          <img src={msg.image} alt="attachment" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '12px', marginTop: '1rem', border: '1px solid var(--border)' }} />
        )}

        {grouped.length > 0 && (
          <div className="reactions-row">
            {grouped.map(({ emoji, userIds }) => (
              <button
                key={emoji}
                className={`reaction-pill ${userIds.includes(currentUser.id) ? 'active' : ''}`}
                onClick={() => onToggleReaction(msg.id, emoji)}
                title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
              >
                {emoji} <span>{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ── ChatArea ──────────────────────────────────────────────────────────────

const ChatArea = ({ channel, user, onNewMessage }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeouts = useRef({});
  const emojiPickerRef = useRef(null);
  const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

  // Browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Load messages + pinned + connect WS on channel change
  useEffect(() => {
    if (!channel) return;
    setMessages([]);
    setReplyTo(null);
    setPinnedMessages([]);
    setShowPinned(false);

    const token = localStorage.getItem('blink_token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API}/api/messages/${channel.id}`, { headers })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => {});

    fetch(`${API}/api/pinned/${channel.id}`, { headers })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPinnedMessages(data); })
      .catch(() => {});

    const socket = new WebSocket(`${WS_URL}/api/ws?room=${channel.id}`);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'join', channelId: channel.id, userId: user.id }));

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new_message') {
          setTypingUsers(prev => { const n = { ...prev }; delete n[data.message.user_id]; return n; });
          setMessages(prev => [...prev, data.message]);
          if (data.message.user_id !== user.id) {
            if (document.hidden && Notification.permission === 'granted') {
              new Notification(`${data.message.full_name} in ${channel.type === 'DM' ? channel.other_user_name : '#' + channel.name}`, {
                body: data.message.content?.slice(0, 80),
                icon: '/favicon.ico',
              });
            }
            onNewMessage?.(channel.id, {
              senderName: data.message.full_name,
              preview: (data.message.content || '').slice(0, 60),
              channel,
            });
          }
        }

        if (data.type === 'typing') {
          setTypingUsers(prev => ({ ...prev, [data.userId]: data.userName }));
          clearTimeout(typingTimeouts.current[data.userId]);
          typingTimeouts.current[data.userId] = setTimeout(() => {
            setTypingUsers(prev => { const n = { ...prev }; delete n[data.userId]; return n; });
          }, 3000);
        }

        if (data.type === 'message_edited') {
          setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, content: data.content, edited_at: data.editedAt } : m));
        }

        if (data.type === 'message_deleted') {
          setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, is_deleted: 1 } : m));
        }

        if (data.type === 'reaction_updated') {
          setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
        }

        if (data.type === 'message_pinned') {
          const token = localStorage.getItem('blink_token');
          fetch(`${API}/api/pinned/${channel.id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (Array.isArray(d)) setPinnedMessages(d); }).catch(() => {});
        }

        if (data.type === 'message_unpinned') {
          setPinnedMessages(prev => prev.filter(p => p.message_id !== data.messageId));
        }
      } catch {}
    };

    wsRef.current = socket;
    return () => { socket.close(); wsRef.current = null; };
  }, [channel]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sendWS = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }, []);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendWS({
      type: 'message',
      channelId: channel.id,
      userId: user.id,
      userName: user.full_name,
      avatarUrl: user.avatar_url,
      content: inputText.trim(),
      replyToId: replyTo?.id || null,
    });
    setInputText('');
    setReplyTo(null);
  }, [inputText, channel, user, replyTo, sendWS]);

  const handleToggleReaction = useCallback((messageId, emoji) => {
    sendWS({ type: 'toggle_reaction', messageId, emoji, userId: user.id, channelId: channel.id });
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = m.reactions || [];
      const has = reactions.some(r => r.emoji === emoji && r.user_id === user.id);
      return {
        ...m, reactions: has
          ? reactions.filter(r => !(r.emoji === emoji && r.user_id === user.id))
          : [...reactions, { emoji, user_id: user.id }],
      };
    }));
  }, [sendWS, user, channel]);

  const handleEdit = useCallback((messageId, content) => {
    sendWS({ type: 'edit_message', messageId, content, userId: user.id, channelId: channel.id });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m));
  }, [sendWS, user, channel]);

  const handleDelete = useCallback((messageId) => {
    sendWS({ type: 'delete_message', messageId, userId: user.id, userRole: user.role, channelId: channel.id });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: 1 } : m));
  }, [sendWS, user, channel]);

  const handlePin = useCallback((messageId) => {
    sendWS({ type: 'pin_message', messageId, userId: user.id, channelId: channel.id });
  }, [sendWS, user, channel]);

  const handleUnpin = useCallback((messageId) => {
    sendWS({ type: 'unpin_message', messageId, channelId: channel.id });
    setPinnedMessages(prev => prev.filter(p => p.message_id !== messageId));
  }, [sendWS, channel]);

  const handleFileSend = ({ file, caption }) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(), user_id: user.id, full_name: user.full_name,
      content: caption || '', file: { name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` },
      timestamp: new Date().toISOString(), reactions: [], is_deleted: 0,
    }]);
  };

  const pinnedIds = useMemo(() => new Set(pinnedMessages.map(p => p.message_id)), [pinnedMessages]);
  const channelTitle = channel.type === 'DM' ? channel.other_user_name : channel.name;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {channel.type === 'DM' ? <MessageCircle size={20} className="text-muted" /> : <Hash size={20} className="text-muted" />}
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{channelTitle}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {pinnedMessages.length > 0 && (
              <button onClick={() => setShowPinned(p => !p)} className="text-muted" title="Pinned messages" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: showPinned ? 'var(--primary)' : undefined }}>
                <Pin size={16} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{pinnedMessages.length}</span>
              </button>
            )}
            <Search size={18} className="text-muted" />
            <button onClick={() => { setShowProfile(p => !p); setShowFiles(false); }} className="text-muted" style={{ display: 'flex', color: showProfile ? 'var(--primary)' : undefined }}>
              <Users size={18} />
            </button>
            <button onClick={() => { setShowFiles(f => !f); setShowProfile(false); }} className="text-muted" style={{ display: 'flex', color: showFiles ? 'var(--primary)' : undefined }}>
              <FolderOpen size={18} />
            </button>
          </div>
        </header>

        {/* Pinned messages panel */}
        {showPinned && pinnedMessages.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Pin size={13} style={{ color: 'var(--primary)' }} /> {pinnedMessages.length} Pinned Message{pinnedMessages.length > 1 ? 's' : ''}
              </span>
              <button onClick={() => setShowPinned(false)} className="text-muted"><X size={14} /></button>
            </div>
            {pinnedMessages.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{p.author_name}</span>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {p.is_deleted ? 'This message was deleted.' : p.content}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => handleUnpin(p.message_id)} className="text-muted" title="Unpin" style={{ flexShrink: 0 }}>
                    <PinOff size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="chat-area" ref={scrollRef}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.9rem' }}>
              {channel.type === 'DM'
                ? `Start a conversation with ${channel.other_user_name}`
                : `No messages yet. Be the first to say something in #${channel.name}!`}
            </div>
          )}
          {messages.map(msg => (
            <MessageItem
              key={msg.id}
              msg={msg}
              currentUser={user}
              isAdmin={isAdmin}
              onReply={setReplyTo}
              onToggleReaction={handleToggleReaction}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPin={handlePin}
              onUnpin={handleUnpin}
              isPinned={pinnedIds.has(msg.id)}
              onAvatarClick={(u) => { setProfileUser(u); setShowProfile(true); }}
            />
          ))}
        </div>

        {/* Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div style={{ padding: '0 1.5rem 0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing</span>
            <span style={{ display: 'inline-flex', gap: '3px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--text-muted)', display: 'inline-block', animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </span>
          </div>
        )}

        {/* Input */}
        <div className="input-area">
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
              <Reply size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Replying to <strong style={{ color: 'var(--text-main)' }}>{replyTo.full_name}</strong>: {replyTo.content}
              </span>
              <button onClick={() => setReplyTo(null)} className="text-muted"><X size={13} /></button>
            </div>
          )}

          <div className="input-container" style={{ border: '1px solid var(--border)', padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="text-muted" onClick={() => setIsModalOpen(true)}><Paperclip size={20} /></button>
              <button className="text-muted"><ImageIcon size={20} /></button>
              <button className="text-muted"><AtSign size={20} /></button>
              <div style={{ position: 'relative' }} ref={emojiPickerRef}>
                <button className="text-muted" onClick={() => setShowEmojiPicker(p => !p)}><Smile size={20} /></button>
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', bottom: '2.5rem', left: 0, zIndex: 100 }}>
                    <Picker data={data} onEmojiSelect={e => { setInputText(p => p + e.native); setShowEmojiPicker(false); }} theme="light" previewPosition="none" skinTonePosition="none" />
                  </div>
                )}
              </div>
            </div>
            <textarea
              className="message-input"
              placeholder={channel.type === 'DM' ? `Message ${channel.other_user_name}…` : `Message #${channel.name}…`}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'typing', channelId: channel.id, userId: user.id, userName: user.full_name }));
                }
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              style={{ color: 'var(--text-main)' }}
            />
            <button className="send-btn" onClick={handleSend} disabled={!inputText.trim()}><Send size={18} /></button>
          </div>
        </div>
      </div>

      {showProfile && <ProfileSidebar user={profileUser} onClose={() => setShowProfile(false)} />}
      {showFiles && !showProfile && <FileSidebar messages={messages} onClose={() => setShowFiles(false)} />}
      <FileModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSend={handleFileSend} />
    </div>
  );
};

export default ChatArea;
