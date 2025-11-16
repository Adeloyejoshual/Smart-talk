// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth, storage } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FiArrowLeft, FiPhone, FiVideo, FiUser, FiSend, FiImage } from "react-icons/fi";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);

  const bottomRef = useRef(null);

  // --------------------------
  // LOAD CHAT PARTNER DATA
  // --------------------------
  useEffect(() => {
    if (!chatId) return;

    const unsub = onSnapshot(doc(db, "users", chatId), (snap) => {
      if (snap.exists()) setChatUser(snap.data());
    });

    return () => unsub();
  }, [chatId]);

  // --------------------------
  // LOAD MESSAGES
  // --------------------------
  useEffect(() => {
    if (!chatId || !currentUser) return;

    const unsub = onSnapshot(
      doc(db, "chats", getChatId(currentUser.uid, chatId)),
      (snap) => {
        if (snap.exists()) {
          setMessages(snap.data().messages || []);
        }
      }
    );

    return () => unsub();
  }, [chatId]);

  // --------------------------
  // AUTO SCROLL
  // --------------------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate chat ID
  function getChatId(a, b) {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }

  // --------------------------
  // SEND MESSAGE
  // --------------------------
  const sendMessage = async () => {
    if (!text.trim()) return;

    const chatRef = doc(db, "chats", getChatId(currentUser.uid, chatId));

    await updateDoc(chatRef, {
      messages: arrayUnion({
        id: Date.now(),
        sender: currentUser.uid,
        text,
        timestamp: serverTimestamp(),
      }),
    });

    setText("");
  };

  // --------------------------
  // SEND IMAGE
  // --------------------------
  const uploadImage = async (file) => {
    const imgRef = ref(storage, `chatImages/${Date.now()}_${file.name}`);
    await uploadBytes(imgRef, file);

    const url = await getDownloadURL(imgRef);

    const chatRef = doc(db, "chats", getChatId(currentUser.uid, chatId));
    await updateDoc(chatRef, {
      messages: arrayUnion({
        id: Date.now(),
        sender: currentUser.uid,
        image: url,
        timestamp: serverTimestamp(),
      }),
    });
  };

  const pickImage = (e) => {
    const file = e.target.files[0];
    if (file) uploadImage(file);
  };

  // --------------------------
  // OPEN PROFILE
  // --------------------------
  const openProfile = () => {
    navigate(`/profile/${chatId}`);
  };

  // --------------------------
  // OPEN VOICE CALL
  // --------------------------
  const startVoiceCall = () => {
    navigate(`/voicecall/${chatId}`);
  };

  // --------------------------
  // OPEN VIDEO CALL
  // --------------------------
  const startVideoCall = () => {
    navigate(`/videocall/${chatId}`);
  };

  // ---------------------------------------------------------------------
  // -------------------------- RENDER UI -------------------------------
  // ---------------------------------------------------------------------
  if (!chatUser) {
    return <div style={{ padding: 20 }}>Loading chat…</div>;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>

      {/* -------------------- HEADER -------------------- */}
      <div
        style={{
          padding: "14px",
          display: "flex",
          alignItems: "center",
          background: "#0d0d0d",
          color: "#fff",
          borderBottom: "1px solid #222",
        }}
      >
        <FiArrowLeft
          size={24}
          style={{ marginRight: 14, cursor: "pointer" }}
          onClick={() => navigate(-1)}
        />

        <img
          src={chatUser.photoURL || "/default-avatar.png"}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            objectFit: "cover",
            marginRight: 12,
          }}
        />

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>
            {chatUser.name || "User"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {chatUser.isOnline ? "Online" : "Offline"}
          </div>
        </div>

        <FiUser
          size={22}
          style={{ marginRight: 16, cursor: "pointer" }}
          onClick={openProfile}
        />

        <FiPhone
          size={22}
          style={{ marginRight: 16, cursor: "pointer" }}
          onClick={startVoiceCall}
        />

        <FiVideo
          size={22}
          style={{ cursor: "pointer" }}
          onClick={startVideoCall}
        />
      </div>

      {/* -------------------- MESSAGES LIST -------------------- */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          background: "#f5f5f5",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.sender === currentUser.uid ? "right" : "left",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: "70%",
                padding: "8px 12px",
                borderRadius: 12,
                background: m.sender === currentUser.uid ? "#4A89DC" : "#fff",
                color: m.sender === currentUser.uid ? "#fff" : "#000",
              }}
            >
              {m.text && <div>{m.text}</div>}
              {m.image && (
                <img
                  src={m.image}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    marginTop: m.text ? 8 : 0,
                  }}
                />
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef}></div>
      </div>

      {/* -------------------- FIXED INPUT BAR -------------------- */}
      <div
        style={{
          padding: "10px",
          display: "flex",
          alignItems: "center",
          borderTop: "1px solid #ccc",
          background: "#fff",
        }}
      >
        <label>
          <FiImage size={20} style={{ cursor: "pointer" }} />
          <input type="file" style={{ display: "none" }} onChange={pickImage} />
        </label>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            marginLeft: 10,
            padding: "10px",
            borderRadius: 20,
            border: "1px solid #ddd",
          }}
        />

        <FiSend
          size={22}
          style={{ marginLeft: 10, cursor: "pointer" }}
          onClick={sendMessage}
        />
      </div>
    </div>
  );
}