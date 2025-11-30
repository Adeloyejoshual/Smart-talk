// src/components/ArchivePage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

export default function ArchivePage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const { user } = useContext(UserContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [newMessages, setNewMessages] = useState({});
  const [search, setSearch] = useState("");

  // Real-time archived chats
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      where("archived", "==", true),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = { id: docSnap.id, ...docSnap.data() };
          const friendId = (chatData.participants || []).find((id) => id !== user.uid);

          if (friendId) {
            const uDoc = await getDoc(doc(db, "users", friendId));
            if (uDoc.exists()) {
              const udata = uDoc.data();
              chatData.name = udata.name || udata.email || chatData.name;
              chatData.photoURL = udata.profilePic || chatData.photoURL || null;
            }
          }

          // Detect new messages
          if (chatData.lastMessageSender !== user.uid && chatData.lastMessageStatus !== "seen") {
            setNewMessages((prev) => ({ ...prev, [chatData.id]: true }));
          }

          return chatData;
        })
      );

      setChats(chatList);
    });

    return () => unsubscribe();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    if (date.getFullYear() !== now.getFullYear()) return date.toLocaleDateString();
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const truncatedMessage = (text) => (text?.length > 35 ? text.slice(0, 35) + "…" : text);

  const handleChatClick = async (chat) => {
    if (newMessages[chat.id]) {
      await updateDoc(doc(db, "chats", chat.id), { lastMessageStatus: "seen" });
      setNewMessages((prev) => {
        const copy = { ...prev };
        delete copy[chat.id];
        return copy;
      });
    }
    navigate(`/chat/${chat.id}`);
  };

  const handleUnarchive = async (chatId) => {
    await updateDoc(doc(db, "chats", chatId), { archived: false });
  };

  const searchResults = chats.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ background: wallpaper || (isDark ? "#121212" : "#fff"), minHeight: "100vh", color: isDark ? "#fff" : "#000", paddingBottom: "90px" }}>
      {/* Header */}
      <div style={{ padding: 10, fontWeight: "bold", fontSize: 18 }}>
        📦 Archived Chats
      </div>

      {/* Search */}
      <div style={{ padding: 10 }}>
        <input
          type="text"
          placeholder="Search archived..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* Chat List */}
      <div style={{ padding: 10 }}>
        {(search ? searchResults : chats).map((chat) => {
          const isNew = newMessages[chat.id];

          return (
            <div
              key={chat.id}
              onClick={() => handleChatClick(chat)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 10,
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 45, height: 45, borderRadius: "50%", overflow: "hidden", background: "#888", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontWeight: "bold" }}>
                  {chat.photoURL ? <img src={chat.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : chat.name ? chat.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p style={{ margin: 0, fontSize: 14, color: isNew ? "#0d6efd" : isDark ? "#ccc" : "#555" }}>
                    {truncatedMessage(chat.lastMessage || "No messages yet")}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <small style={{ color: isNew ? "#0d6efd" : "#888" }}>{formatDate(chat.lastMessageAt)}</small>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnarchive(chat.id); }}
                  style={{ fontSize: 12, padding: "2px 6px", borderRadius: 6, background: "#0d6efd", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  Unarchive
                </button>
              </div>
            </div>
          );
        })}
      </div>
  );
}