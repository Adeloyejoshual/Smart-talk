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
  getDoc,
  doc,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth, storage } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const COLORS = {
  primary: "#34B7F1",
  darkBg: "#0b0b0b",
  lightBg: "#f5f5f5",
  darkText: "#fff",
  lightText: "#000",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
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

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [uploadingFile, setUploadingFile] = useState(null);
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
          if (s.exists()) setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
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
      const docs = snap
        .docs.map((d) => ({ id: d.id, ...d.data() }))
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

  // -------------------- Handle file upload --------------------
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    setUploadingFile(file);
    setUploadingPct(0);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadingPct(progress);
      },
      (error) => {
        console.error(error);
        alert("Upload failed");
        setUploadingFile(null);
        setUploadingPct(null);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);

        let mediaType = "file";
        if (file.type.startsWith("image")) mediaType = "image";
        else if (file.type.startsWith("video")) mediaType = "video";
        else if (file.type.startsWith("audio")) mediaType = "audio";
        else if (file.type === "application/pdf") mediaType = "pdf";

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: myUid,
          mediaUrl: url,
          mediaType,
          fileName: file.name,
          createdAt: serverTimestamp(),
          status: "sent",
          reactions: {},
        });

        setUploadingFile(null);
        setUploadingPct(null);
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    );
  };

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
      <ChatHeader chatInfo={chatInfo} friendInfo={friendInfo} myUid={myUid} navigate={navigate} />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: SPACING.md }}>Loading...</div>}
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            myUid={myUid}
            chatId={chatId}
            uploadingPct={uploadingFile?.name === m.fileName ? uploadingPct : null}
            onReply={() => {}}
            onForward={() => {}}
            onPin={() => {}}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
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
        {/* File input */}
        <input type="file" onChange={handleFileSelect} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ cursor: "pointer", fontSize: 20 }}>
          📎
        </label>

        {/* Text input */}
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

        {/* Send button */}
        <button
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          📩
        </button>
      </div>

      {/* Upload progress */}
      {uploadingPct != null && (
        <div style={{ padding: 4, fontSize: 12, color: COLORS.mutedText }}>
          Uploading {uploadingFile?.name}: {uploadingPct}%
        </div>
      )}
    </div>
  );
}