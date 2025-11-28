// src/components/Chat/ArchivePage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";

export default function ArchivePage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [archivedChats, setArchivedChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  const selectionMode = selectedChats.length > 0;

  // ================= AUTH =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => {
      if (!u) return navigate("/");
      setUser(u);
    });
    return unsubscribe;
  }, [navigate]);

  // ================= LOAD ARCHIVED CHATS =================
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      where("archived", "==", true),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async snapshot => {
      const chatList = await Promise.all(
        snapshot.docs.map(async docSnap => {
          const chatData = { id: docSnap.id, ...docSnap.data() };
          const friendId = chatData.participants.find(id => id !== user.uid);

          if (friendId) {
            const friendSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", friendId))
            );
            if (!friendSnap.empty) {
              const data = friendSnap.docs[0].data();
              chatData.name = data.name || data.email;
              chatData.photoURL = data.profilePic
                ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/${data.profilePic}`
                : null;
            }
          }

          const msgSnap = await getDocs(
            query(
              collection(db, "chats", docSnap.id, "messages"),
              orderBy("createdAt", "desc"),
              limit(1)
            )
          );
          const latest = msgSnap.docs[0]?.data();
          if (latest) {
            chatData.lastMessage = latest.text || "📷 Photo";
            chatData.lastMessageAt = latest.createdAt;
            chatData.lastMessageSender = latest.senderId;
            chatData.lastMessageStatus = latest.status;
          }

          return chatData;
        })
      );

      chatList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0);
      });

      setArchivedChats(chatList.filter(c => !c.deleted));
    });

    return () => unsubscribe();
  }, [user, CLOUDINARY_CLOUD]);

  // ================= HELPERS =================
  const formatDate = timestamp => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString())
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  const toggleSelectChat = chatId => {
    setSelectedChats(prev => {
      const updated = prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId];
      return updated;
    });
  };

  const exitSelectionMode = () => setSelectedChats([]);

  const handleUnarchive = async () => {
    await Promise.all(selectedChats.map(id => updateDoc(doc(db, "chats", id), { archived: false })));
    exitSelectionMode();
  };

  const handleDelete = async () => {
    await Promise.all(selectedChats.map(id => updateDoc(doc(db, "chats", id), { deleted: true })));
    exitSelectionMode();
  };

  const searchResults = archivedChats.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  // ================= RENDER =================
  return (
    <div
      style={{
        background: wallpaper ? `url(${wallpaper}) no-repeat center/cover` : isDark ? "#121212" : "#fff",
        minHeight: "100vh",
        color: isDark ? "#fff" : "#000",
        paddingBottom: "90px",
      }}
    >
      {/* Custom header with back arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: 15,
          background: "#0d6efd",
          color: "#fff",
          fontWeight: "bold",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        }}
      >
        <span
          style={{ cursor: "pointer", fontSize: 22, marginRight: 10 }}
          onClick={() => navigate("/chat")}
        >
          ←
        </span>
        <h2 style={{ margin: 0 }}>Archived Chats</h2>
      </div>

      {/* Search */}
      <div style={{ padding: 10 }}>
        <input
          type="text"
          placeholder="Search archived chats..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* Multi-select actions */}
      {selectionMode && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 10,
            justifyContent: "flex-end",
            borderBottom: "1px solid #ccc",
          }}
        >
          <button onClick={handleUnarchive}>Unarchive</button>
          <button onClick={handleDelete} style={{ color: "red" }}>
            Delete
          </button>
          <button onClick={exitSelectionMode}>Cancel</button>
        </div>
      )}

      {/* Chat list */}
      <div style={{ padding: 10 }}>
        {(search ? searchResults : archivedChats).map(chat => {
          const isSelected = selectedChats.includes(chat.id);
          return (
            <div
              key={chat.id}
              onClick={() => selectionMode ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`)}
              onContextMenu={e => { e.preventDefault(); toggleSelectChat(chat.id); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 10,
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
                background: isSelected ? "rgba(0,123,255,0.2)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 45,
                    height: 45,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "#888",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#fff",
                    fontWeight: "bold",
                  }}
                >
                  {chat.photoURL ? (
                    <img src={chat.photoURL} alt={chat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : chat.name ? chat.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
                    {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>
              <small style={{ color: "#888" }}>{formatDate(chat.lastMessageAt)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}