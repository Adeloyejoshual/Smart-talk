import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebaseClient";
import { v4 as uuidv4 } from "uuid";

export default function ChatRoomPage({ chatId }) {
  const user = auth.currentUser;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const recorderRef = useRef(null);

  // 🔹 Load messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [chatId]);

  // 🔹 Send text / file / voice message
  const sendMessage = async (extraData = {}) => {
    if (!text.trim() && !extraData.url) return;

    const payload = {
      senderId: user.uid,
      text: text.trim() || "",
      type: extraData.type || "text",
      url: extraData.url || null,
      fileName: extraData.fileName || null,
      pinned: extraData.pinned || null,
      createdAt: serverTimestamp(),
      deletedBy: {},
    };

    await addDoc(collection(db, "chats", chatId, "messages"), payload);

    // Update chat last message
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: { text: payload.text, type: payload.type },
      lastMessageTime: serverTimestamp(),
    });

    setText("");
    setMediaFile(null);
  };

  // 🔹 Handle File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const path = `chat_uploads/${chatId}/${uuidv4()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    await sendMessage({
      type: file.type.startsWith("image") ? "image" : "file",
      url,
      fileName: file.name,
    });
    setUploading(false);
  };

  // 🔹 Handle Voice Recording
  const startRecording = async () => {
    if (!navigator.mediaDevices) return alert("Voice recording not supported.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    recorderRef.current = mediaRecorder;
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/m4a" });
      const fileName = `voice_${Date.now()}.m4a`;
      const fileRef = ref(storage, `voice_notes/${chatId}/${fileName}`);
      await uploadBytes(fileRef, blob);
      const url = await getDownloadURL(fileRef);
      await sendMessage({ type: "audio", url });
      setRecording(false);
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  // 🔹 Delete message (for me or everyone)
  const deleteMessage = async (msg, forEveryone = false) => {
    const msgRef = doc(db, "chats", chatId, "messages", msg.id);
    if (forEveryone) {
      await updateDoc(msgRef, { deletedForAll: true, text: "Message deleted" });
    } else {
      await updateDoc(msgRef, { [`deletedBy.${user.uid}`]: true });
    }
  };

  // 🔹 Pin message with expiry
  const pinMessage = async (msg, duration = "30d") => {
    const expiresAt = new Date();
    if (duration === "24h") expiresAt.setDate(expiresAt.getDate() + 1);
    else if (duration === "7d") expiresAt.setDate(expiresAt.getDate() + 7);
    else if (duration === "30d") expiresAt.setDate(expiresAt.getDate() + 30);
    else if (duration === "12h") expiresAt.setHours(expiresAt.getHours() + 12);

    await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
      pinned: { by: user.uid, until: expiresAt },
    });
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#fff" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {messages.map((m) =>
          m.deletedForAll || m.deletedBy?.[user.uid] ? null : (
            <div
              key={m.id}
              style={{
                margin: "8px 0",
                alignSelf: m.senderId === user.uid ? "flex-end" : "flex-start",
                background: m.senderId === user.uid ? "#dcf8c6" : "#f1f1f1",
                padding: "8px 12px",
                borderRadius: "12px",
                maxWidth: "70%",
              }}
            >
              {m.type === "image" && <img src={m.url} alt="" style={{ width: "100%", borderRadius: 8 }} />}
              {m.type === "audio" && <audio controls src={m.url} style={{ width: "100%" }} />}
              {m.type === "file" && (
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  📎 {m.fileName}
                </a>
              )}
              {m.type === "text" && <div>{m.text}</div>}

              <div style={{ fontSize: 12, color: "#777", textAlign: "right", marginTop: 4 }}>
                {m.pinned && <span>📌 </span>}
                {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString() : ""}
              </div>

              {/* Menu for actions */}
              <div style={{ textAlign: "right", marginTop: 2 }}>
                <button onClick={() => pinMessage(m, "30d")}>📌 Pin</button>
                <button onClick={() => deleteMessage(m, false)}>🗑️ Delete (Me)</button>
                <button onClick={() => deleteMessage(m, true)}>🚫 Delete (All)</button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid #ddd",
          padding: "10px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "8px 12px", borderRadius: "20px", border: "1px solid #ccc" }}
        />
        <input type="file" onChange={handleFileUpload} style={{ display: "none" }} id="fileInput" />
        <label htmlFor="fileInput" style={{ cursor: "pointer" }}>📎</label>
        {recording ? (
          <button onClick={stopRecording}>⏹️ Stop</button>
        ) : (
          <button onClick={startRecording}>🎤</button>
        )}
        <button disabled={!text.trim() && !mediaFile && uploading} onClick={() => sendMessage()}>
          ➤
        </button>
      </div>
    </div>
  );
}