import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  Paperclip, Image as ImageIcon, AtSign, Smile, Send, Search, Users,
  FolderOpen, Hash, File, Download, Pin, PinOff, Reply, Edit2, Trash2,
  X, Check, ChevronDown, MessageCircle, Bell, BellOff,
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

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

function extractUrls(text) {
  return text ? [...text.matchAll(URL_REGEX)].map(m => m[0]) : [];
}

function parseMarkdown(text) {
  if (!text) return '';
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
    const i = blocks.length;
    blocks.push(`<pre class="md-pre"><code>${code.trim()}</code></pre>`);
    return `\x00B${i}\x00`;
  });

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
  s = s.replace(/@(\w+)/g, '<span style="color:var(--primary);font-weight:600">@$1</span>');
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

const MessageItem = memo(({ msg, currentUser, isAdmin, onReply, onToggleReaction, onEdit, onDelete, onPin, onUnpin, isPinned, onAvatarClick, onJump, isJumping, linkPreviews, onFetchPreview, isSeenTarget }) => {
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

  const urls = extractUrls(msg.content || '');

  return (
    <div
      className="message"
      data-message-id={msg.id}
      style={{ position: 'relative', transition: 'background-color 0.5s', backgroundColor: isJumping ? 'rgba(99,102,241,0.15)' : undefined }}
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
          <div className="reply-context" style={{ cursor: 'pointer' }} onClick={() => onJump?.(msg.reply_to_id)}>
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

        {/* Link previews */}
        {urls.map(url => {
          const preview = linkPreviews?.[url];
          if (!preview) {
            if (onFetchPreview && linkPreviews && !(url in linkPreviews)) onFetchPreview(url);
            return null;
          }
          if (!preview.title) return null;
          return (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', marginTop: '0.5rem', maxWidth: '440px', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-main)' }}>
              {preview.image && <img src={preview.image} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />}
              <div style={{ padding: '0.625rem 0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{preview.siteName}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>{preview.title}</div>
                {preview.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{preview.description}</div>}
              </div>
            </a>
          );
        })}

        {/* Read receipt */}
        {isSeenTarget && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Check size={11} /><Check size={11} style={{ marginLeft: -6 }} /> Seen
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
  const [notifPermission, setNotifPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [jumpingTo, setJumpingTo] = useState(null);
  const [readReceipts, setReadReceipts] = useState([]);
  const inputRef = useRef(null);

  const requestNotifPermission = async () => {
    if (!('Notification' in window) || notifPermission === 'denied') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  // Load users for @mention autocomplete
  useEffect(() => {
    const token = localStorage.getItem('blink_token');
    fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setMentionUsers(d); }).catch(() => {});
  }, []);

  // Read receipts for DMs
  useEffect(() => {
    if (channel.type !== 'DM') return;
    const token = localStorage.getItem('blink_token');
    fetch(`${API}/api/read-receipt/${channel.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    const fetchReceipts = () => fetch(`${API}/api/read-receipt/${channel.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setReadReceipts(d); }).catch(() => {});
    fetchReceipts();
    const interval = setInterval(fetchReceipts, 5000);
    return () => clearInterval(interval);
  }, [channel.id]);

  const filteredMentions = mentionQuery !== null
    ? mentionUsers.filter(u => (u.full_name || '').toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];

  const insertMention = (u) => {
    const firstName = u.full_name.split(' ')[0];
    const pos = inputRef.current?.selectionStart || inputText.length;
    const before = inputText.slice(0, pos).replace(/@\w*$/, `@${firstName} `);
    setInputText(before + inputText.slice(pos));
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const jumpToMessage = useCallback((messageId) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setJumpingTo(messageId);
      setTimeout(() => setJumpingTo(null), 2000);
    }
  }, []);

  const fetchLinkPreview = useCallback((url) => {
    setLinkPreviews(prev => {
      if (url in prev) return prev;
      const token = localStorage.getItem('blink_token');
      fetch(`${API}/api/link-preview?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => {
          if (!d.error) setLinkPreviews(p => ({ ...p, [url]: d }));
          else setLinkPreviews(p => ({ ...p, [url]: null }));
        }).catch(() => setLinkPreviews(p => ({ ...p, [url]: null })));
      return { ...prev, [url]: null };
    });
  }, []);

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const token = localStorage.getItem('blink_token');
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&channelId=${channel.id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setSearchResults(Array.isArray(d) ? d : []);
    } catch {}
    setSearchLoading(false);
  }, [channel.id]);

  // Compute "seen" target: last own message the other user has read (DM only)
  const seenMessageId = useMemo(() => {
    if (channel.type !== 'DM') return null;
    const other = readReceipts.find(r => r.user_id !== user.id);
    if (!other) return null;
    const readAt = new Date(other.last_read_at);
    const ownMsgs = messages.filter(m => m.user_id === user.id && new Date(m.timestamp) <= readAt);
    return ownMsgs.length ? ownMsgs[ownMsgs.length - 1].id : null;
  }, [readReceipts, messages, user.id, channel.type]);

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
            if (Notification.permission === 'granted') {
              new Notification(`${data.message.full_name} in ${channel.type === 'DM' ? channel.other_user_name : '#' + channel.name}`, {
                body: data.message.content?.slice(0, 80),
                icon: '/favicon.ico',
              });
            }
            if (!document.hidden) {
              onNewMessage?.(channel.id, {
                senderName: data.message.full_name,
                preview: (data.message.content || '').slice(0, 60),
                channel,
              });
            }
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
            <button
              onClick={requestNotifPermission}
              className="text-muted"
              title={notifPermission === 'granted' ? 'Notifications enabled' : notifPermission === 'denied' ? 'Notifications blocked in browser settings' : 'Enable notifications'}
              style={{ display: 'flex', color: notifPermission === 'granted' ? 'var(--primary)' : undefined }}
            >
              {notifPermission === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <button onClick={() => { setShowSearch(p => !p); setSearchQuery(''); setSearchResults([]); }} className="text-muted" style={{ color: showSearch ? 'var(--primary)' : undefined }}>
              <Search size={18} />
            </button>
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

        {/* Search panel */}
        {showSearch && (
          <div style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', padding: '0.75rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text" placeholder="Search messages…" autoFocus
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); runSearch(e.target.value); }}
                style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', backgroundColor: 'var(--bg-chat)', color: 'var(--text-main)' }}
              />
              <button onClick={() => setShowSearch(false)} className="text-muted"><X size={16} /></button>
            </div>
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {searchLoading && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Searching…</p>}
              {!searchLoading && searchQuery && searchResults.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>No results found.</p>
              )}
              {searchResults.map(r => (
                <button key={r.id} onClick={() => { jumpToMessage(r.id); setShowSearch(false); }}
                  style={{ width: '100%', textAlign: 'left', padding: '0.5rem', borderRadius: '8px', background: 'none', display: 'block' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-chat)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '2px' }}>{r.full_name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatTime(r.timestamp)}</div>
                </button>
              ))}
            </div>
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
              onJump={jumpToMessage}
              isJumping={jumpingTo === msg.id}
              linkPreviews={linkPreviews}
              onFetchPreview={fetchLinkPreview}
              isSeenTarget={seenMessageId === msg.id}
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
            {filteredMentions.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-md)', zIndex: 200, overflow: 'hidden', marginBottom: '4px' }}>
                {filteredMentions.map((u, i) => (
                  <button key={u.id} onClick={() => insertMention(u)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.75rem', background: i === mentionIndex ? 'var(--primary-light)' : 'none', textAlign: 'left' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                      {(u.full_name || '?')[0]}
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>{u.full_name}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              className="message-input"
              placeholder={channel.type === 'DM' ? `Message ${channel.other_user_name}…` : `Message #${channel.name}…`}
              value={inputText}
              onChange={e => {
                const val = e.target.value;
                setInputText(val);
                const pos = e.target.selectionStart;
                const before = val.slice(0, pos);
                const match = before.match(/@(\w*)$/);
                setMentionQuery(match ? match[1].toLowerCase() : null);
                setMentionIndex(0);
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'typing', channelId: channel.id, userId: user.id, userName: user.full_name }));
                }
              }}
              onKeyDown={e => {
                if (filteredMentions.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % filteredMentions.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + filteredMentions.length) % filteredMentions.length); return; }
                  if (e.key === 'Enter') { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
                  if (e.key === 'Escape') { setMentionQuery(null); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
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
