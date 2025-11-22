import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, limit as fsLimit } from "firebase/firestore";
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
  const fileInputRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), fsLimit(2000));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !(m.deletedFor?.includes(myUid)));
      setMessages(docs);
      setLoadingMsgs(false);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId, myUid]);

  const sendTextMessage = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: myUid,
      text: text.trim(),
      createdAt: serverTimestamp(),
      status: "sent",
      reactions: {},
    });
    setText("");
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "YOUR_CLOUDINARY_PRESET");

    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload failed");

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        mediaUrl: data.secure_url,
        mediaType: "file",
        fileName: file.name,
        createdAt: serverTimestamp(),
        status: "sent",
        reactions: {},
      });
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("File upload failed");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg), color: isDark ? COLORS.darkText : COLORS.lightText }}>
      <ChatHeader chatInfo={chatInfo} friendInfo={friendInfo} myUid={myUid} navigate={navigate} />

      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: SPACING.sm }}>
        {loadingMsgs && <div style={{ textAlign: "center", marginTop: SPACING.md }}>Loading...</div>}
        {messages.map(m => <MessageItem key={m.id} message={m} myUid={myUid} chatId={chatId} onReply={() => {}} onPin={() => {}} onForward={() => {}} />)}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: SPACING.sm, padding: SPACING.sm, borderTop: `1px solid ${COLORS.grayBorder}`, background: isDark ? COLORS.darkCard : COLORS.lightCard }}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: `1px solid ${COLORS.grayBorder}`, outline: "none", background: isDark ? COLORS.darkBg : "#fff", color: isDark ? COLORS.darkText : COLORS.lightText }} onKeyDown={(e) => e.key === "Enter" && sendTextMessage()} />
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current.click()}>📎</button>
        <button onClick={sendTextMessage}>📩</button>
      </div>
    </div>
  );
}