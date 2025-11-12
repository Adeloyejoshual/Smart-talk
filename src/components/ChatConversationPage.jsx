import React, { useEffect, useState, useRef } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth, storage } from "../firebaseConfig";
import { useParams, useNavigate } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [friend, setFriend] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const bottomRef = useRef();

  const user = auth.currentUser;

  // 🧩 Fetch chat & friend info
  useEffect(() => {
    if (!chatId || !user) return;

    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) {
        const chatData = snap.data();
        setChat(chatData);
        const friendId = chatData.participants.find((id) => id !== user.uid);
        if (friendId) {
          const friendRef = doc(db, "users", friendId);
          onSnapshot(friendRef, (fSnap) => {
            if (fSnap.exists()) setFriend({ id: fSnap.id, ...fSnap.data() });
          });
        }
      }
    });

    return () => unsubChat();
  }, [chatId, user]);

  // 💬 Listen for messages realtime
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // scroll to bottom
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

      // mark seen
      msgs.forEach(async (msg) => {
        if (msg.receiverId === user.uid && msg.status !== "seen") {
          await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
            status: "seen",
          });
        }
      });
    });

    return () => unsub();
  }, [chatId, user]);

  // ✉️ Send text or image
  const sendMessage = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      let imageUrl = null;

      if (file) {
        const imgRef = ref(storage, `chatImages/${chatId}/${Date.now()}-${file.name}`);
        await uploadBytes(imgRef, file);
        imageUrl = await getDownloadURL(imgRef);
      }

      const msg = {
        text,
        imageUrl,
        senderId: user.uid,
        receiverId: chat.participants.find((id) => id !== user.uid),
        createdAt: serverTimestamp(),
        status: "sent",
        type: imageUrl ? "image" : "text",
      };

      await addDoc(collection(db, "chats", chatId, "messages"), msg);
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: imageUrl ? "📷 Photo" : text,
        lastMessageAt: serverTimestamp(),
      });

      setText("");
      setPreview(null);
      setFile(null);
    } catch (e) {
      console.error("Send message error:", e);
    }
    setSending(false);
  };

  // 📸 Handle file input + preview
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setFile(null);
  };

  // 🕒 Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="chat-page" style={styles.page}>
      {/* Header pinned */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>←</button>
        <img
          src={friend?.photoURL || "https://via.placeholder.com/40"}
          alt="profile"
          style={styles.avatar}
        />
        <div>
          <div style={{ fontWeight: 600 }}>{friend?.displayName || "Chat"}</div>
          <small style={{ color: "#b3e0d2" }}>
            {friend?.isOnline ? "Online" : "Last seen recently"}
          </small>
        </div>
      </div>

      {/* Message list (scrollable middle) */}
      <div style={styles.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageBubble,
              alignSelf: msg.senderId === user.uid ? "flex-end" : "flex-start",
              background: msg.senderId === user.uid ? "#DCF8C6" : "#fff",
            }}
          >
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="img"
                style={{ width: "100%", borderRadius: "10px", marginBottom: msg.text ? 6 : 0 }}
              />
            )}
            {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
            <small style={styles.time}>
              {formatTime(msg.createdAt)}{" "}
              {msg.senderId === user.uid &&
                (msg.status === "seen" ? "✓✓" : msg.status === "delivered" ? "✓✓" : "✓")}
            </small>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      {/* Image preview box */}
      {preview && (
        <div style={styles.previewBox}>
          <img src={preview} alt="preview" style={styles.previewImg} />
          <button onClick={cancelPreview} style={styles.cancelBtn}>✖</button>
        </div>
      )}

      {/* Input pinned bottom */}
      <div style={styles.inputBar}>
        <label style={styles.attachLabel}>
          📎
          <input type="file" accept="image/*" hidden onChange={handleFileChange} />
        </label>
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          style={styles.input}
        />
        <button onClick={sendMessage} disabled={sending} style={styles.sendBtn}>
          {sending ? "..." : "➤"}
        </button>
      </div>
    </div>
  );
}

// 🧱 Styles
const styles = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f5f5f5",
  },
  header: {
    background: "#075E54",
    color: "white",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "white",
    fontSize: 20,
    cursor: "pointer",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
  },
  messages: {
    flexGrow: 1,
    overflowY: "auto",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  messageBubble: {
    padding: "10px",
    borderRadius: "10px",
    maxWidth: "75%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  time: { fontSize: "11px", color: "#777", marginTop: 4, float: "right" },
  inputBar: {
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    background: "#fff",
    borderTop: "1px solid #ddd",
    position: "sticky",
    bottom: 0,
    zIndex: 10,
  },
  input: {
    flexGrow: 1,
    border: "1px solid #ccc",
    borderRadius: "20px",
    padding: "8px 14px",
    outline: "none",
  },
  sendBtn: {
    background: "#25D366",
    border: "none",
    borderRadius: "50%",
    width: 40,
    height: 40,
    color: "#fff",
    fontSize: 18,
    marginLeft: 8,
    cursor: "pointer",
  },
  attachLabel: { cursor: "pointer", fontSize: 22, marginRight: 8 },
  previewBox: {
    position: "fixed",
    bottom: 70,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#fff",
    borderRadius: "12px",
    padding: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    zIndex: 15,
  },
  previewImg: { width: 80, height: 80, borderRadius: "8px", objectFit: "cover" },
  cancelBtn: {
    border: "none",
    background: "#ff4d4f",
    color: "white",
    borderRadius: "50%",
    width: 25,
    height: 25,
    cursor: "pointer",
  },
};