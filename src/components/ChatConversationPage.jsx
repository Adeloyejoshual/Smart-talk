// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import ChatInput from "./ChatInput";

// -------------------- Helpers --------------------
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// -------------------- Component --------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId || !myUid) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });

          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const userRef = doc(db, "users", friendId);
            unsubUser = onSnapshot(userRef, (s) => {
              if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
            });
          }
        }

        unsubChat = onSnapshot(doc(db, "chats", chatId), (s) => {
          if (s.exists()) setChatInfo(prev => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => { if (unsubChat) unsubChat(); if (unsubUser) unsubUser(); };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId || !myUid) return;
    setLoadingMsgs(true);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt","asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>!(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      setLoadingMsgs(false);
      if(isAtBottom) endRef.current?.scrollIntoView({behavior:"smooth"});
    });
    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  useEffect(() => {
    const el = messagesRefEl.current;
    if(!el) return;
    const onScroll = () => { setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => { endRef.current?.scrollIntoView({behavior:"smooth"}); setIsAtBottom(true); };

  // -------------------- Render message --------------------
  const renderMessage = (m) => {
    const isMine = m.senderId === myUid;
    return (
      <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: 8 }}>
        <div style={{ maxWidth: "70%", padding: 8, borderRadius: 12, backgroundColor: isMine ? "#34B7F1" : (isDark ? "#1b1b1b" : "#fff"), color: isMine ? "#fff" : (isDark ? "#fff" : "#000") }}>
          {m.text && <div>{m.text}</div>}
          {m.mediaUrl && (
            <div style={{ marginTop: 4 }}>
              {m.mediaType === "image" && <img src={m.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: 12 }} />}
              {m.mediaType === "video" && <video src={m.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: 12 }} />}
              {m.mediaType === "audio" && <audio src={m.mediaUrl} controls />}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#888", marginTop: 2, textAlign: "right" }}>
            {m.edited && "(edited)"} {fmtTime(m.createdAt)} {m.status && isMine ? `• ${m.status}` : ""}
          </div>
        </div>
      </div>
    );
  };

  // -------------------- JSX Return --------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"), color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <div style={{ height: 56, backgroundColor: "#1877F2", color: "#fff", display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => friendInfo?.id && navigate(`/UserProfilePage/${friendInfo.id}`)}>
          <button onClick={(e)=>{e.stopPropagation(); navigate(-1);}} style={{ background:"transparent", border:"none", color:"#fff", fontSize:18 }}>←</button>

          {/* Profile: Cloudinary or Initial */}
          {friendInfo?.photoURL ? (
            <img src={friendInfo.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          ) : (
            <div style={{ width:36, height:36, borderRadius:"50%", background:"#888", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:600 }}>
              {getInitials(friendInfo?.name)}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 600 }}>{friendInfo?.name || "Chat"}</div>
            <div style={{ fontSize: 12, color: "#eee" }}>
              {friendInfo?.online ? "Online" : "Last seen unknown"}
            </div>
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div ref={messagesRefEl} style={{ flex:1, overflowY:"auto", padding:8 }}>
        {loadingMsgs && <div style={{ textAlign:"center", marginTop:20 }}>Loading...</div>}
        {messages.map(renderMessage)}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={async () => {
          if (!text.trim()) return;
          try {
            await addDoc(collection(db, "chats", chatId, "messages"), {
              senderId: myUid,
              text: text.trim(),
              createdAt: serverTimestamp(),
              status: "sent",
            });
            setText("");
            scrollToBottom();
          } catch(e) { console.error(e); }
        }}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
      />
    </div>
  );
}