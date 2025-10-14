// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth, storage } from "../firebaseConfig";
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [chatInfo, setChatInfo] = useState(null);
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const recorderRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 👤 Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/");
      else setUser(u);
    });
    return unsubscribe;
  }, [navigate]);

  // 📄 Load chat info
  useEffect(() => {
    const loadChat = async () => {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (snap.exists()) setChatInfo(snap.data());
    };
    loadChat();
  }, [chatId]);

  // 💬 Real-time messages
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 📎 File handler
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(selected.name);
    }
  };

  // 🎙 Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (error) {
      alert("Microphone access denied!");
    }
  };

  // 🛑 Stop recording
  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  // 🗑 Cancel audio
  const cancelAudio = () => {
    setAudioBlob(null);
    setAudioURL(null);
  };

  // 📤 Send message (text, file, or audio)
  const sendMessage = async () => {
    if ((!newMsg.trim() && !file && !audioBlob) || !user) return;
    setUploading(true);

    let fileUrl = null;
    let fileType = null;
    let fileName = null;

    if (file) {
      const fileRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      fileUrl = await getDownloadURL(fileRef);
      fileType = file.type;
      fileName = file.name;
    } else if (audioBlob) {
      const audioRef = ref(storage, `chatAudio/${chatId}/${Date.now()}.webm`);
      await uploadBytes(audioRef, audioBlob);
      fileUrl = await getDownloadURL(audioRef);
      fileType = "audio/webm";
      fileName = "Voice Message";
    }

    const msgRef = collection(db, "chats", chatId, "messages");
    await addDoc(msgRef, {
      text: newMsg.trim(),
      senderId: user.uid,
      createdAt: serverTimestamp(),
      fileUrl: fileUrl || "",
      fileType: fileType || "",
      fileName: fileName || "",
    });

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: fileUrl
        ? fileType.startsWith("image/")
          ? "📷 Photo"
          : fileType.startsWith("audio/")
          ? "🎤 Voice message"
          : "📎 File"
        : newMsg.trim(),
      lastMessageAt: serverTimestamp(),
    });

    setNewMsg("");
    setFile(null);
    setPreview(null);
    setAudioBlob(null);
    setAudioURL(null);
    setUploading(false);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper
          ? `url(${wallpaper}) center/cover no-repeat`
          : theme === "dark"
          ? "#0e0e0e"
          : "#f2f2f2",
        color: theme === "dark" ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "15px",
          background: theme === "dark" ? "#1f1f1f" : "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "20px",
            color: theme === "dark" ? "#fff" : "#000",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <h3>{chatInfo?.name || "Chat"}</h3>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.senderId === user?.uid ? "flex-end" : "flex-start",
              background:
                msg.senderId === user?.uid
                  ? "#25D366"
                  : theme === "dark"
                  ? "#333"
                  : "#e4e4e4",
              color: msg.senderId === user?.uid ? "#fff" : "#000",
              padding: "10px 15px",
              borderRadius: "15px",
              marginBottom: "10px",
              maxWidth: "70%",
            }}
          >
            {/* Image */}
            {msg.fileUrl && msg.fileType?.startsWith("image/") && (
              <img
                src={msg.fileUrl}
                alt="chat-img"
                style={{ width: "100%", borderRadius: "10px" }}
              />
            )}

            {/* Audio */}
            {msg.fileUrl && msg.fileType?.startsWith("audio/") && (
              <audio controls src={msg.fileUrl} style={{ width: "100%" }} />
            )}

            {/* File */}
            {msg.fileUrl &&
              !msg.fileType?.startsWith("image/") &&
              !msg.fileType?.startsWith("audio/") && (
                <a
                  href={msg.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: msg.senderId === user?.uid ? "#fff" : "#007bff",
                    textDecoration: "underline",
                  }}
                >
                  📎 {msg.fileName || "Download file"}
                </a>
              )}

            {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Audio preview */}
      {audioURL && (
        <div
          style={{
            padding: "10px",
            background: "#000000cc",
            color: "#fff",
            textAlign: "center",
          }}
        >
          <audio controls src={audioURL} style={{ width: "100%" }} />
          <div style={{ marginTop: "5px" }}>
            <button
              onClick={cancelAudio}
              style={{
                background: "red",
                border: "none",
                color: "#fff",
                padding: "5px 10px",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          display: "flex",
          padding: "10px",
          background: theme === "dark" ? "#1e1e1e" : "#fff",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <input
          type="file"
          onChange={handleFileChange}
          style={{ display: "none" }}
          id="fileInput"
        />
        <label htmlFor="fileInput" style={{ fontSize: "20px", cursor: "pointer" }}>
          📎
        </label>

        {recording ? (
          <button
            onClick={stopRecording}
            style={{
              padding: "10px",
              background: "red",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
            }}
          >
            ⏹
          </button>
        ) : (
          <button
            onClick={startRecording}
            style={{
              padding: "10px",
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
            }}
          >
            🎤
          </button>
        )}

        <input
          type="text"
          placeholder="Type a message"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "20px",
            border: "1px solid #ccc",
            outline: "none",
            background: theme === "dark" ? "#2a2a2a" : "#f5f5f5",
            color: theme === "dark" ? "#fff" : "#000",
          }}
        />

        <button
          onClick={sendMessage}
          disabled={uploading}
          style={{
            padding: "10px 15px",
            background: "#25D366",
            border: "none",
            color: "#fff",
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}