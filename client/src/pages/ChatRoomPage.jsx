// /src/pages/ChatRoomPage.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseClient";
import { useAuth } from "../context/AuthContext";

// 🔊 optional: for voice recording
import { BsMicFill, BsSend, BsPaperclip } from "react-icons/bs";
import { IoImageOutline } from "react-icons/io5";
import { FiTrash2 } from "react-icons/fi";
import { MdPushPin } from "react-icons/md";

export default function ChatRoomPage({ chatId, otherUser }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const messagesEndRef = useRef(null);

  const chatRef = doc(db, "chats", chatId);
  const messagesRef = collection(chatRef, "messages");

  // ------------------------------
  // 🔄 Load Messages Realtime
  // ------------------------------
  useEffect(() => {
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(data);
      scrollToBottom();
    });
    return () => unsub();
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // ------------------------------
  // 💬 Send Message
  // ------------------------------
  const sendMessage = async (type = "text", content = input) => {
    if (!content.trim() && type === "text") return;

    await addDoc(messagesRef, {
      from: user.uid,
      to: otherUser.uid,
      type,
      content,
      createdAt: serverTimestamp(),
      deletedFor: [],
    });

    await updateDoc(chatRef, {
      lastMessage: content,
      lastMessageAt: serverTimestamp(),
    });

    setInput("");
  };

  // ------------------------------
  // 📷 Upload Image/File
  // ------------------------------
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await sendMessage("file", url);
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
  };

  // ------------------------------
  // 🎙️ Voice Recording
  // ------------------------------
  const handleVoice = async () => {
    if (recording) {
      mediaRecorder.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const fileRef = ref(storage, `voice/${chatId}/${Date.now()}.webm`);
          await uploadBytes(fileRef, blob);
          const url = await getDownloadURL(fileRef);
          await sendMessage("voice", url);
        };
        recorder.start();
        setMediaRecorder(recorder);
        setRecording(true);
      } catch (err) {
        alert("Mic access denied");
      }
    }
  };

  // ------------------------------
  // 🗑️ Delete Message
  // ------------------------------
  const deleteMessage = async (msg, forEveryone = false) => {
    const msgRef = doc(messagesRef, msg.id);
    if (forEveryone) {
      await deleteDoc(msgRef);
    } else {
      await updateDoc(msgRef, {
        deletedFor: [...(msg.deletedFor || []), user.uid],
      });
    }
  };

  // ------------------------------
  // 📌 Pin Message (Expire)
  // ------------------------------
  const pinMessage = async (msg, duration) => {
    const expiresAt = Date.now() + duration; // ms from now
    const pinsRef = doc(db, "chats", chatId, "pins", msg.id);
    await setDoc(pinsRef, {
      messageId: msg.id,
      pinnedBy: user.uid,
      content: msg.content,
      expiresAt,
      createdAt: serverTimestamp(),
    });
  };

  // ------------------------------
  // 🖼️ Render
  // ------------------------------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f5f5f5",
      }}
    >
      {/* Chat Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#fff",
          borderBottom: "1px solid #ddd",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={otherUser.photoURL || "/assets/default-avatar.png"}
            alt="Profile"
            style={{ width: 35, height: 35, borderRadius: "50%" }}
          />
          <div>
            <strong>{otherUser.name}</strong>
            <div style={{ fontSize: 12, color: "#888" }}>
              {/* Online status shown only here */}
              {otherUser.online ? "Online" : `Last seen ${otherUser.lastSeen}`}
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={() => pinMessage(messages[messages.length - 1], 30 * 24 * 60 * 60 * 1000)}
            style={iconBtn}
          >
            <MdPushPin />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages.map((msg) =>
          msg.deletedFor?.includes(user.uid) ? null : (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.from === user.uid ? "flex-end" : "flex-start",
                background: msg.from === user.uid ? "#007bff" : "#e5e5ea",
                color: msg.from === user.uid ? "#fff" : "#000",
                padding: "8px 12px",
                borderRadius: 12,
                margin: "4px 0",
                maxWidth: "75%",
                wordBreak: "break-word",
                position: "relative",
              }}
            >
              {msg.type === "text" && <span>{msg.content}</span>}
              {msg.type === "file" && (
                <a href={msg.content} target="_blank" rel="noopener noreferrer">
                  <IoImageOutline /> View File
                </a>
              )}
              {msg.type === "voice" && (
                <audio controls src={msg.content} style={{ width: "100%" }} />
              )}

              <div
                style={{
                  position: "absolute",
                  bottom: -18,
                  right: 5,
                  fontSize: 10,
                  color: "#999",
                }}
              >
                {msg.createdAt?.toDate
                  ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </div>

              <div
                style={{
                  position: "absolute",
                  top: -10,
                  right: 0,
                  display: "flex",
                  gap: 4,
                }}
              >
                <button onClick={() => deleteMessage(msg)} style={iconMini}>
                  <FiTrash2 />
                </button>
              </div>
            </div>
          )
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Input Area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px",
          background: "#fff",
          borderTop: "1px solid #ddd",
          gap: 8,
        }}
      >
        <button onClick={handleVoice} style={iconBtn}>
          <BsMicFill color={recording ? "red" : "black"} />
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          style={{
            flex: 1,
            border: "1px solid #ccc",
            borderRadius: 20,
            padding: "8px 14px",
            outline: "none",
          }}
        />

        <label style={iconBtn}>
          <BsPaperclip />
          <input
            type="file"
            hidden
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>

        <button onClick={() => sendMessage()} style={iconBtn}>
          <BsSend />
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 20,
};

const iconMini = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  color: "#fff",
};