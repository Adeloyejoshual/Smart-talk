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
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef();

  const user = auth.currentUser;

  // 🧩 Fetch chat & friend info
  useEffect(() => {
    if (!chatId || !user) return;

    const unsubChat = onSnapshot(doc(db, "chats", chatId), async (snap) => {
      if (snap.exists()) {
        const chatData = snap.data();
        setChat(chatData);

        // Friend details
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

  // 💬 Listen for real-time messages
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // Auto scroll down
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

      // ✅ Mark messages as seen
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

  // ✉️ Send text message
  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = {
        text,
        senderId: user.uid,
        receiverId: chat.participants.find((id) => id !== user.uid),
        createdAt: serverTimestamp(),
        status: "sent",
        type: "text",
      };

      await addDoc(collection(db, "chats", chatId, "messages"), msg);
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      console.error("Send message error:", e);
    }
    setSending(false);
  };

  // 📷 Send image
  const sendImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const imgRef = ref(storage, `chatImages/${chatId}/${Date.now()}-${file.name}`);
      await uploadBytes(imgRef, file);
      const url = await getDownloadURL(imgRef);

      const msg = {
        text: "",
        imageUrl: url,
        senderId: user.uid,
        receiverId: chat.participants.find((id) => id !== user.uid),
        createdAt: serverTimestamp(),
        status: "sent",
        type: "image",
      };

      await addDoc(collection(db, "chats", chatId, "messages"), msg);
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: "📷 Photo",
        lastMessageAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Image upload error:", error);
    }
    setUploading(false);
  };

  // 🕒 Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f5f5f5",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#075E54",
          color: "white",
          padding: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <img
          src={friend?.photoURL || "https://via.placeholder.com/50"}
          alt="profile"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
        <div>
          <h3 style={{ margin: 0 }}>{friend?.displayName || "Chat"}</h3>
          <small style={{ color: "#b3e0d2" }}>
            {friend?.isOnline ? "Online" : "Last seen recently"}
          </small>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flexGrow: 1,
          overflowY: "auto",
          padding: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.senderId === user.uid ? "flex-end" : "flex-start",
              background: msg.senderId === user.uid ? "#DCF8C6" : "#fff",
              padding: "10px",
              borderRadius: "10px",
              maxWidth: "75%",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            {msg.type === "image" && (
              <img
                src={msg.imageUrl}
                alt="sent"
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  marginBottom: msg.text ? "5px" : "0",
                }}
              />
            )}
            {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
            <small style={{ float: "right", color: "#888" }}>
              {formatTime(msg.createdAt)}{" "}
              {msg.senderId === user.uid &&
                (msg.status === "seen" ? "✓✓" : msg.status === "delivered" ? "✓✓" : "✓")}
            </small>
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "10px",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderTop: "1px solid #ddd",
        }}
      >
        <label>
          📎
          <input type="file" accept="image/*" hidden onChange={sendImage} />
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          style={{
            flexGrow: 1,
            padding: "10px",
            borderRadius: "20px",
            border: "1px solid #ccc",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={sending || uploading}
          style={{
            background: "#25D366",
            border: "none",
            borderRadius: "50%",
            width: "45px",
            height: "45px",
            color: "white",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          {uploading ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
}