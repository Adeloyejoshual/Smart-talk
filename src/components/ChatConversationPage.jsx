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
  doc,
  getDoc,
  limit as fsLimit,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";

const COLORS = {
  primary: "#34B7F1",
  darkBg: "#0b0b0b",
  lightBg: "#f5f5f5",
  darkText: "#fff",
  lightText: "#000",
  grayBorder: "rgba(0,0,0,0.06)",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
};

const SPACING = { sm: 8, md: 12, borderRadius: 12 };

export default function ChatConversationPage({ user }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = user?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const audioInputRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [uploadingPct, setUploadingPct] = useState(null);

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
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

        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists())
            setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => {
      unsubChat?.();
      unsubUser?.();
    };
  }, [chatId, myUid]);

  // -------------------- Messages realtime --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      fsLimit(2000)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      setLoadingMsgs(false);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId, myUid]);

  // -------------------- Send text --------------------
  const sendTextMessage = async () => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text: text.trim(),
        createdAt: serverTimestamp(),
        status: "sent",
        reactions: {},
      });
      setText("");
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      console.error(e);
      alert("Failed to send");
    }
  };

  // -------------------- Upload audio to Cloudinary --------------------
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "YOUR_CLOUDINARY_PRESET"); // <-- replace with your preset

    try {
      setUploadingPct(0);
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload", // <-- replace with your Cloud name
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload failed");

      // Send audio message
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        mediaUrl: data.secure_url,
        mediaType: "audio",
        fileName: file.name,
        createdAt: serverTimestamp(),
        status: "sent",
        reactions: {},
      });
      setUploadingPct(null);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("Audio upload failed");
      setUploadingPct(null);
    }
  };

  const handleReply = (msg) => console.log("Reply", msg);
  const handlePin = (msg) => console.log("Pin", msg);
  const handleForward = (msg) => console.log("Forward", msg);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg),
        color: isDark ? COLORS.darkText : COLORS.lightText,
      }}
    >
      {/* Header */}
      <ChatHeader
        chatInfo={chatInfo}
        friendInfo={friendInfo}
        myUid={myUid}
        navigate={navigate}
      />

      {/* Messages scrollable */}
      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}
      >
        {loadingMsgs && (
          <div style={{ textAlign: "center", marginTop: SPACING.md }}>
            Loading...
          </div>
        )}

        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            myUid={myUid}
            chatId={chatId}
            onReply={handleReply}
            onPin={handlePin}
            onForward={handleForward}
            uploadingPct={uploadingPct}
          />
        ))}

        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: SPACING.sm,
          display: "flex",
          gap: SPACING.sm,
          borderTop: `1px solid ${COLORS.grayBorder}`,
          background: isDark ? COLORS.darkCard : COLORS.lightCard,
          alignItems: "center",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: SPACING.sm,
            borderRadius: SPACING.borderRadius,
            border: `1px solid ${COLORS.grayBorder}`,
            outline: "none",
            background: isDark ? COLORS.darkBg : "#fff",
            color: isDark ? COLORS.darkText : COLORS.lightText,
          }}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
        />
        <input
          type="file"
          accept="audio/*"
          ref={audioInputRef}
          style={{ display: "none" }}
          onChange={handleAudioUpload}
        />
        <button
          onClick={() => audioInputRef.current.click()}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          🎤
        </button>
        <button
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          📩
        </button>
      </div>
    </div>
  );
}