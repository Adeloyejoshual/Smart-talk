// File: src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  limit as fsLimit,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { ThemeContext } from '../../context/ThemeContext';

import Header from './Header';
import ThreeDotMenu from './ThreeDotMenu';
import LongPressToolbar from './LongPressToolbar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const INLINE_REACTIONS = ['❤️', '😂', '👍', '😮', '😢'];

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const myUid = auth.currentUser?.uid;
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  // state
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploadingIds, setUploadingIds] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerMenuExpanded, setHeaderMenuExpanded] = useState(false);

  // ---------- load chat meta + friend ----------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    const loadMeta = async () => {
      try {
        const cRef = doc(db, 'chats', chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });
          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const fRef = doc(db, 'users', friendId);
            const fSnap = await getDoc(fRef);
            if (fSnap.exists()) setFriendInfo({ id: fSnap.id, ...fSnap.data() });
            else setFriendInfo({ id: friendId });
          }
        }
        unsubChat = onSnapshot(doc(db, 'chats', chatId), (s) => {
          if (s.exists()) {
            setChatInfo((p) => ({ ...(p || {}), ...s.data() }));
          }
        });
      } catch (e) {
        console.error('loadMeta error', e);
      }
    };
    loadMeta();
    return () => { if (unsubChat) unsubChat(); };
  }, [chatId, myUid]);

  // ---------- messages realtime ----------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const msgsRef = collection(db, 'chats', chatId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'), fsLimit(2000));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter((m) => !(m.deletedFor && m.deletedFor.includes(myUid)));
      setMessages(filtered);
      // mark delivered for incoming messages
      filtered.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === 'sent') {
          try {
            await updateDoc(doc(db, 'chats', chatId, 'messages', m.id), { status: 'delivered' });
          } catch (e) { /* ignore */ }
        }
      });
      setLoadingMsgs(false);
      // auto-scroll if at bottom
      setTimeout(() => { if (isAtBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 80);
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- recording availability ----------
  useEffect(() => {
    setRecorderAvailable(!!(navigator.mediaDevices && window.MediaRecorder));
  }, []);

  // ---------- file select & preview ----------
  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPreviews = files.map((f) => ({
      url: (f.type.startsWith('image/') || f.type.startsWith('video/')) ? URL.createObjectURL(f) : null,
      type: f.type,
      name: f.name,
      file: f,
    }));
    setSelectedFiles((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...newPreviews]);
  };

  // ---------- send message (text OR files) ----------
  const sendTextMessage = async () => {
    // blocked?
    const blockedBy = chatInfo?.blockedBy || [];
    if (blockedBy.includes(myUid)) {
      alert('You are blocked in this chat.');
      return;
    }

    // send files if present
    if (selectedFiles.length > 0) {
      const filesToSend = [...selectedFiles];
      // clear UI immediately
      setSelectedFiles([]);
      setPreviews([]);
      setSelectedPreviewIndex(0);

      // NOTE: this example doesn't include Cloudinary upload function (modular). 
      // If you have `uploadToCloudinary`, call it inside the loop and update the message with returned URL.
      for (const file of filesToSend) {
        try {
          const placeholder = {
            senderId: myUid,
            text: '',
            mediaUrl: '',
            mediaType: file.type.split('/')[0],
            fileName: file.name,
            createdAt: serverTimestamp(),
            status: 'uploading',
            reactions: {},
          };
          const mRef = await addDoc(collection(db, 'chats', chatId, 'messages'), placeholder);
          const messageId = mRef.id;
          setUploadingIds((prev) => ({ ...prev, [messageId]: 0 }));

          // If you integrate Cloudinary or another uploader:
          // const url = await uploadToCloudinary(file, pct => setUploadingIds(prev => ({...prev, [messageId]: pct})));
          // await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { mediaUrl: url, status: 'sent', sentAt: serverTimestamp() });

          // For demo, mark as sent without a real URL:
          await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { status: 'sent', sentAt: serverTimestamp() });

          // cleanup
          setTimeout(() => setUploadingIds((p) => { const c = { ...p }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error('file send error', err);
        }
      }
      return;
    }

    // send text
    if (text.trim()) {
      try {
        const payload = {
          senderId: myUid,
          text: text.trim(),
          mediaUrl: '',
          mediaType: null,
          createdAt: serverTimestamp(),
          status: 'sent',
          reactions: {},
        };
        if (replyTo) {
          payload.replyTo = { id: replyTo.id, text: replyTo.text || replyTo.mediaType || 'media', senderId: replyTo.senderId };
          setReplyTo(null);
        }
        await addDoc(collection(db, 'chats', chatId, 'messages'), payload);
        setText('');
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      } catch (e) {
        console.error('sendTextMessage error', e);
        alert('Failed to send');
      }
    }
  };

  // ---------- recording (press & hold) ----------
  const startRecording = async () => {
    if (!recorderAvailable) return alert('Recording not supported in this browser');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) recorderChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: 'audio/webm' });
        try {
          const placeholder = {
            senderId: myUid,
            text: '',
            mediaUrl: '',
            mediaType: 'audio',
            fileName: `voice-${Date.now()}.webm`,
            createdAt: serverTimestamp(),
            status: 'uploading',
            reactions: {},
          };
          const mRef = await addDoc(collection(db, 'chats', chatId, 'messages'), placeholder);
          const messageId = mRef.id;
          setUploadingIds((p) => ({ ...p, [messageId]: 0 }));

          // If you integrate upload:
          // const url = await uploadToCloudinary(blob, pct => setUploadingIds(prev => ({...prev, [messageId]: pct})));
          // await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { mediaUrl: url, status: 'sent', sentAt: serverTimestamp() });

          // For demo, mark as sent:
          await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { status: 'sent', sentAt: serverTimestamp() });

          setTimeout(() => setUploadingIds((p) => { const c = { ...p }; delete c[messageId]; return c; }), 200);
        } catch (err) {
          console.error('voice upload failed', err);
        }
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error('startRecording error', err);
      alert('Could not start recording');
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    } catch (e) { /* ignore */ }
    setRecording(false);
  };

  // ---------- reactions ----------
  const applyReaction = async (messageId, emoji) => {
    try {
      const mRef = doc(db, 'chats', chatId, 'messages', messageId);
      const snap = await getDoc(mRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const existing = data.reactions?.[myUid];
      if (existing === emoji) {
        // remove reaction
        await updateDoc(mRef, { [`reactions.${myUid}`]: null });
      } else {
        await updateDoc(mRef, { [`reactions.${myUid}`]: emoji });
      }
      setReactionFor(null);
    } catch (e) {
      console.error('applyReaction error', e);
    }
  };

  // ---------- header/menu actions ----------
  const openProfile = () => {
    if (!friendInfo?.id) return alert('Profile not found');
    navigate(`/profile/${friendInfo.id}`);
    setHeaderMenuOpen(false);
  };
  const startVoiceCall = () => {
    if (!friendInfo?.id) return alert('User not available');
    navigate(`/voicecall/${friendInfo.id}`);
  };
  const startVideoCall = () => {
    if (!friendInfo?.id) return alert('User not available');
    navigate(`/videocall/${friendInfo.id}`);
  };

  const headerPrimary = [
    { id: 'view-profile', label: 'View Profile', action: () => openProfile() },
    { id: 'mute', label: 'Mute Notifications', action: () => alert('Muted (placeholder)') },
    { id: 'block', label: (chatInfo?.blockedBy || []).includes(myUid) ? 'Unblock' : 'Block User', action: async () => {
      const chatRef = doc(db, 'chats', chatId);
      const snap = await getDoc(chatRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const blockedBy = data.blockedBy || [];
      if (blockedBy.includes(myUid)) await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
      else await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
    } },
    { id: 'clear', label: 'Clear Chat', action: async () => {
      if (!confirm('Clear chat?')) return;
      const msgsRef = collection(db, 'chats', chatId, 'messages');
      const snap = await getDocs(query(msgsRef, orderBy('createdAt', 'asc')));
      for (const d of snap.docs) { try { await deleteDoc(d.ref); } catch (e) {} }
      alert('Chat cleared.');
    } },
    { id: 'delete', label: 'Delete Chat', action: async () => {
      if (!confirm('Delete this chat?')) return;
      const msgsRef = collection(db, 'chats', chatId, 'messages');
      const snap = await getDocs(query(msgsRef, orderBy('createdAt', 'asc')));
      for (const d of snap.docs) { try { await deleteDoc(d.ref); } catch (e) {} }
      await deleteDoc(doc(db, 'chats', chatId));
      navigate('/chat');
    } },
    { id: 'archive', label: 'Archive Chat', action: () => alert('Archive placeholder') },
  ];

  const headerMore = [
    { id: 'search', label: 'Search', action: () => alert('Open search (placeholder)') },
    { id: 'wallpaper', label: 'Wallpaper/Theme', action: () => alert('Wallpaper picker (placeholder)') },
    { id: 'report', label: 'Report', action: () => { if (confirm('Do you want to report this user?')) alert('Reported'); } },
  ];

  // ---------- scroll detection ----------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // ---------- render ----------
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : (isDark ? '#070707' : '#f5f5f5'),
      color: isDark ? '#fff' : '#000',
    }}>
      <Header
        friendInfo={friendInfo}
        onBack={() => navigate('/chat')}
        onOpenProfile={openProfile}
        onVoiceCall={startVoiceCall}
        onVideoCall={startVideoCall}
        onOpenMenu={() => { setHeaderMenuOpen((s) => !s); setHeaderMenuExpanded(false); }}
        isDark={isDark}
      />

      {/* header menu (positioned near header) */}
      <div style={{ position: 'relative' }}>
        {headerMenuOpen && (
          <div style={{ position: 'absolute', right: 12, top: 0 }}>
            <ThreeDotMenu
              open={headerMenuOpen}
              primaryActions={headerPrimary}
              moreActions={headerMore}
              onClose={() => setHeaderMenuOpen(false)}
              expanded={headerMenuExpanded}
              setExpanded={setHeaderMenuExpanded}
            />
          </div>
        )}
      </div>

      <main ref={messagesRefEl} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loadingMsgs && <div style={{ textAlign: 'center', color: '#888', marginTop: 12 }}>Loading messages…</div>}

        <MessageList
          messages={messages}
          myUid={myUid}
          friendInfo={friendInfo}
          isDark={isDark}
          onLongPress={(m) => { setReactionFor(m.id); }}
          onOpenMenu={(m) => setMenuOpenFor(m.id)}
          onReact={(m) => setReactionFor(m.id)}
        />

        <div ref={endRef} />
      </main>

      {/* pinned reply preview */}
      {replyTo && (
        <div style={{ position: 'sticky', bottom: 84, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', background: isDark ? '#101010' : '#fff', padding: 8, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', zIndex: 90 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 4, height: 40, background: '#34B7F1', borderRadius: 4 }} />
            <div style={{ maxWidth: '85%' }}>
              <div style={{ fontSize: 12, color: '#888' }}>{replyTo.senderId === myUid ? 'You' : 'Them'}</div>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.text || (replyTo.mediaType || 'media')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { const id = replyTo.id; const el = document.getElementById(`msg-${id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setReplyTo(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>Go</button>
            <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* previews strip */}
      {previews.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: 8, overflowX: 'auto', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.06)', background: isDark ? '#0b0b0b' : '#fff' }}>
          {previews.map((p, idx) => (
            <div key={idx} style={{ position: 'relative', cursor: 'pointer', border: idx === selectedPreviewIndex ? `2px solid #34B7F1` : 'none', borderRadius: 8 }}>
              {p.url ? (p.type.startsWith('image/') ? <img onClick={() => setSelectedPreviewIndex(idx)} src={p.url} alt={p.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} /> : <video onClick={() => setSelectedPreviewIndex(idx)} src={p.url} style={{ width: 110, height: 80, objectFit: 'cover', borderRadius: 8 }} />) : (<div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: '#eee' }}>{p.name}</div>)}
              <button onClick={() => { setSelectedFiles((sf) => sf.filter((_, i) => i !== idx)); setPreviews((ps) => { const copy = ps.filter((_, i) => i !== idx); setSelectedPreviewIndex((prev) => Math.max(0, Math.min(prev, copy.length - 1))); return copy; }); }} style={{ position: 'absolute', top: -6, right: -6, background: '#ff4d4f', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer' }}>×</button>
            </div>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={sendTextMessage} style={{ padding: '8px 12px', borderRadius: 8, background: '#34B7F1', color: '#fff', border: 'none', cursor: 'pointer' }}>➤</button>
            <button onClick={() => { setSelectedFiles([]); setPreviews([]); setSelectedPreviewIndex(0); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#ddd', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}

      <MessageInput
        text={text}
        setText={setText}
        onAttach={onFilesSelected}
        onSend={sendTextMessage}
        previews={previews}
        setPreviews={setPreviews}
        startRecording={startRecording}
        recording={recording}
        stopRecording={stopRecording}
      />

      <LongPressToolbar
        open={!!reactionFor}
        onSelectReaction={(r) => { if (reactionFor) applyReaction(reactionFor, r); setReactionFor(null); }}
        reactions={INLINE_REACTIONS}
        onClose={() => setReactionFor(null)}
      />
    </div>
  );
}

// shared style
const menuBtnStyle = {
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
};