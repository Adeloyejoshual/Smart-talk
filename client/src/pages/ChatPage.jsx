import React from "react";
import { auth, db } from "../firebaseClient";
import { SettingsContext } from "../context/SettingsContext";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function ChatPage() {
  const { theme } = React.useContext(SettingsContext) || { theme: "light" };
  const [messages, setMessages] = React.useState([]);
  const [newMessage, setNewMessage] = React.useState("");
  const [showScroll, setShowScroll] = React.useState(false);
  const messagesEndRef = React.useRef(null);
  const scrollContainerRef = React.useRef(null);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await addDoc(collection(db, "messages"), {
      text: newMessage,
      uid: auth.currentUser.uid,
      photoURL: auth.currentUser.photoURL,
      displayName: auth.currentUser.displayName,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // show scroll-down arrow when not near bottom
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    setShowScroll(distanceFromBottom > 100);
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: theme === "dark" ? "#0f0f0f" : "#fafafa",
        color: theme === "dark" ? "#fff" : "#000",
        transition: "background 0.3s",
      }}
    >
      {/* Scrollable Chat Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf:
                msg.uid === auth.currentUser?.uid ? "flex-end" : "flex-start",
              background:
                msg.uid === auth.currentUser?.uid ? "#007bff" : "#e5e5e5",
              color: msg.uid === auth.currentUser?.uid ? "#fff" : "#000",
              padding: "8px 12px",
              borderRadius: "12px",
              maxWidth: "75%",
              wordBreak: "break-word",
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll Down Arrow */}
      {showScroll && (
        <button
          onClick={scrollToBottom}
          style={{
            position: "absolute",
            bottom: 80,
            right: 20,
            border: "none",
            borderRadius: "50%",
            width: 40,
            height: 40,
            background: "#007bff",
            color: "#fff",
            fontSize: 20,
            cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          }}
        >
          ↓
        </button>
      )}

      {/* Message Input */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          borderTop: "1px solid #ddd",
          padding: "10px",
          background: theme === "dark" ? "#1a1a1a" : "#fff",
        }}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "20px",
            border: "1px solid #ccc",
            outline: "none",
            background: theme === "dark" ? "#2b2b2b" : "#f0f0f0",
            color: theme === "dark" ? "#fff" : "#000",
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: "8px",
            background: "#007bff",
            border: "none",
            color: "#fff",
            borderRadius: "20px",
            padding: "0 16px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}