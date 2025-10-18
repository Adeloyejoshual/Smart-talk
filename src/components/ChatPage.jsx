import React, { useEffect, useState, useContext } from "react";
import { db, auth } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // 🔐 Listen for auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        loadChats(u.uid);
      } else {
        navigate("/");
      }
    });
    return unsubscribe;
  }, [navigate]);

  // 💬 Load user chats
  const loadChats = (uid) => {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChats(chatList);
    });

    return () => unsub();
  };

  // 📱 Open selected chat
  const openChat = (chat) => {
    navigate(`/chat/${chat.id}`);
  };

  return (
    <div
      style={{
        background: wallpaper
          ? `url(${wallpaper}) no-repeat center/cover`
          : theme === "dark"
          ? "#121212"
          : "#fff",
        minHeight: "100vh",
        color: theme === "dark" ? "#fff" : "#000",
        paddingBottom: "70px",
      }}
    >
      {/* 🟢 Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: theme === "dark" ? "#1f1f1f" : "#f5f5f5",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 2,
        }}
      >
        <h2 style={{ margin: 0 }}>Chats</h2>
        <button
          onClick={() => navigate("/settings")}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          ⚙️
        </button>
      </div>

      {/* 👋 Welcome Banner */}
      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "15px 20px",
            borderBottom:
              theme === "dark" ? "1px solid #333" : "1px solid #eee",
          }}
        >
          <img
            src={user.photoURL || "https://via.placeholder.com/50"}
            alt="user"
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <div>
            <h3 style={{ margin: 0 }}>
              Welcome, {user.displayName || user.email.split("@")[0]} 👋
            </h3>
            <small style={{ color: "#888" }}>Ready to start chatting?</small>
          </div>
        </div>
      )}

      {/* 🔍 Search bar */}
      <div style={{ padding: "10px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: theme === "dark" ? "#222" : "#fff",
            color: theme === "dark" ? "#fff" : "#000",
          }}
        />
      </div>

      {/* 💬 Chat list */}
      <div style={{ padding: "10px" }}>
        {chats
          .filter(
            (c) =>
              c.name?.toLowerCase().includes(search.toLowerCase()) ||
              c.lastMessage?.toLowerCase().includes(search.toLowerCase())
          )
          .map((chat) => (
            <div
              key={chat.id}
              onClick={() => openChat(chat)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src={chat.photoURL || "https://via.placeholder.com/50"}
                  alt="profile"
                  style={{ width: 45, height: 45, borderRadius: "50%" }}
                />
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: theme === "dark" ? "#ccc" : "#555",
                    }}
                  >
                    {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>
              <small style={{ color: "#888" }}>
                {chat.lastMessageAt
                  ? new Date(chat.lastMessageAt.seconds * 1000).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )
                  : ""}
              </small>
            </div>
          ))}
      </div>

      {/* ➕ Floating new chat button */}
      <button
        onClick={() => navigate("/new-chat")}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          background: "#25D366",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "60px",
          height: "60px",
          fontSize: "28px",
          cursor: "pointer",
          boxShadow: "0 3px 6px rgba(0,0,0,0.2)",
        }}
      >
        +
      </button>
    </div>
  );
}