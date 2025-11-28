// src/components/ChatPage/ArchivePage.jsx
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
  getDoc,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";
import ChatHeader from "./Header";

export default function ArchivePage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const profileInputRef = useRef(null);

  // ================= AUTH =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
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
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = { id: docSnap.id, ...docSnap.data() };
          if (!chatData.archived) return null; // only archived chats
          const friendId = chatData.participants.find((id) => id !== user.uid);

          if (friendId) {
            const friendSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", friendId))
            );
            if (!friendSnap.empty) {
              const data = friendSnap.docs[0].data();
              chatData.name = data.name || data.email;
              chatData.photoURL = data.profilePic || null;
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

      setChats(chatList.filter(Boolean));
    });
    return () => unsubscribe();
  }, [user]);

  // ================= HELPERS =================
  const formatDate = (timestamp) => {
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

  const renderMessageTick = (chat) => {
    if (chat.lastMessageSender !== user?.uid) return null;
    if (chat.lastMessageStatus === "sent") return "✓";
    if (chat.lastMessageStatus === "delivered") return "✓✓";
    if (chat.lastMessageStatus === "seen") return <span style={{ color: "#25D366" }}>✓✓</span>;
    return "";
  };

  // ================= CHAT ACTIONS =================
  const toggleSelectChat = (chatId) => {
    setSelectedChats((prev) => {
      const updated = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      setSelectionMode(updated.length > 0);
      return updated;
    });
  };

  const enterSelectionMode = (chatId) => {
    setSelectedChats([chatId]);
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectedChats([]);
    setSelectionMode(false);
  };

  const handleUnarchive = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { archived: false })));
    exitSelectionMode();
  };

  const handleDelete = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { deleted: true })));
    exitSelectionMode();
  };

  const handleMute = async (durationMs) => {
    const mutedUntil = new Date().getTime() + durationMs;
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { mutedUntil })));
    exitSelectionMode();
  };

  const handlePin = async (chatId) => {
    const pinnedChats = chats.filter(c => c.pinned && c.id !== chatId);
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;
    const currentPinned = chatSnap.data().pinned || false;
    if (!currentPinned && pinnedChats.length >= 3) {
      alert("You can only pin up to 3 chats");
      return;
    }
    await updateDoc(chatRef, { pinned: !currentPinned });
  };

  const handleBlock = async (chatId) => {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;
    const currentBlocked = chatSnap.data().blocked || false;
    await updateDoc(chatRef, { blocked: !currentBlocked });
  };

  const filteredChats = search
    ? chats.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(search.toLowerCase())
      )
    : chats;

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
      {/* Header */}
      <ChatHeader
        selectedChats={chats.filter(c => selectedChats.includes(c.id))}
        user={user}
        onArchive={handleUnarchive}
        onDelete={handleDelete}
        onMute={handleMute}
        onPin={(ids) => selectedChats.forEach(id => handlePin(id))}
        onMarkRead={async () => { await Promise.all(selectedChats.map(id => updateDoc(doc(db, "chats", id), { lastMessageStatus: "seen" }))); exitSelectionMode(); }}
        onMarkUnread={async () => { await Promise.all(selectedChats.map(id => updateDoc(doc(db, "chats", id), { lastMessageStatus: "delivered" }))); exitSelectionMode(); }}
        onBlock={(ids) => selectedChats.forEach(id => handleBlock(id))}
        onClearChat={async () => { await Promise.all(selectedChats.map(id => { const messagesRef = collection(db, "chats", id, "messages"); return getDocs(messagesRef).then(snap => snap.docs.map(d => updateDoc(d.ref, { text: "", deleted: true }))); })); exitSelectionMode(); }}
        onSettingsClick={() => navigate("/settings")}
        selectionMode={selectionMode}
        exitSelectionMode={exitSelectionMode}
        isDark={isDark}
      />

      {/* Back arrow */}
      <div
        onClick={() => navigate("/chat")}
        style={{ padding: 10, cursor: "pointer", fontWeight: "bold" }}
      >
        ← Back to Chats
      </div>

      {/* Search */}
      <div style={{ padding: 10 }}>
        <input
          type="text"
          placeholder="Search archived chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* Chat list */}
      <div style={{ padding: 10 }}>
        {filteredChats.map(chat => {
          const isMuted = chat.mutedUntil && chat.mutedUntil > new Date().getTime();
          const isSelected = selectedChats.includes(chat.id);
          return (
            <div
              key={chat.id}
              onClick={() => selectionMode ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`)}
              onContextMenu={e => { e.preventDefault(); enterSelectionMode(chat.id); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 10,
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
                background: isSelected
                  ? "rgba(0,123,255,0.2)"
                  : isMuted
                    ? isDark ? "#2c2c2c" : "#f0f0f0"
                    : "transparent",
                opacity: chat.blocked ? 0.5 : 1,
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
                  {chat.pinned && <span style={{ marginLeft: 5 }}>📌</span>}
                  {chat.blocked && <span style={{ marginLeft: 5, color: "red" }}>🚫</span>}
                  <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555", display: "flex", alignItems: "center", gap: 5 }}>
                    {renderMessageTick(chat)} {chat.lastMessage || "No messages yet"}
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