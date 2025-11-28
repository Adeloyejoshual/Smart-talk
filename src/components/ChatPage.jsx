// src/components/ChatPage/ChatPage.jsx
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
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import ChatHeader from "./ChatPage/Header";
import AddFriendPopup from "./ChatPage/AddFriendPopup";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [profilePic, setProfilePic] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);

  const profileInputRef = useRef(null);

  // ================= AUTH & LOAD PROFILE =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfilePic(data.profilePic || null);
        setProfileName(data.name || "");
      }
    });
    return unsubscribe;
  }, [navigate]);

  // ================= LOAD CHATS REAL-TIME =================
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
          const friendId = chatData.participants.find((id) => id !== user.uid);

          if (friendId) {
            const friendSnap = await getDocs(query(collection(db, "users"), where("uid", "==", friendId)));
            if (!friendSnap.empty) {
              const data = friendSnap.docs[0].data();
              chatData.name = data.name || data.email;
              chatData.photoURL = data.profilePic || null;
            }
          }

          // Last message
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

      // Sort pinned first, then newest
      chatList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0);
      });

      setChats(chatList.filter((c) => !c.deleted));
    });
    return () => unsubscribe();
  }, [user]);

  // ================= HELPERS =================
  const getInitials = (fullName) => {
    if (!fullName) return "U";
    const names = fullName.trim().split(" ").filter(Boolean);
    return names.length > 1 ? (names[0][0] + names[1][0]).toUpperCase() : names[0][0].toUpperCase();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  // ================= PROFILE UPLOAD =================
  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url || data.url;
  };

  const handleProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setProfilePic(URL.createObjectURL(file));
    try {
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", user.uid), { profilePic: url, updatedAt: serverTimestamp() });
      setProfilePic(url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload avatar");
    }
  };

  const openProfileUploader = () => profileInputRef.current?.click();

  // ================= CHAT ACTIONS =================
  const toggleSelectChat = (chatId) => {
    setSelectedChats((prev) => {
      const updated = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      return updated;
    });
  };

  const handleArchive = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { archived: true })));
    setSelectedChats([]);
  };

  const handleDelete = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { deleted: true })));
    setSelectedChats([]);
  };

  const handleMute = async (durationMs) => {
    const mutedUntil = new Date().getTime() + durationMs;
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { mutedUntil })));
    setSelectedChats([]);
  };

  const handlePin = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { pinned: true })));
    setSelectedChats([]);
  };

  const handleMarkRead = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { lastMessageStatus: "seen" })));
    setSelectedChats([]);
  };

  const handleMarkUnread = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { lastMessageStatus: "delivered" })));
    setSelectedChats([]);
  };

  const handleClearChat = async () => {
    await Promise.all(selectedChats.map((id) => {
      const messagesRef = collection(db, "chats", id, "messages");
      return getDocs(messagesRef).then(snap => snap.docs.map(d => updateDoc(d.ref, { text: "", deleted: true })));
    }));
    setSelectedChats([]);
  };

  const handleBlock = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { blocked: true })));
    setSelectedChats([]);
  };

  // ================= CHAT FILTERS =================
  const visibleChats = chats.filter(c => !c.archived);
  const searchResults = chats.filter(c =>
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
      {/* Header */}
      <ChatHeader
        selectedChats={chats.filter((c) => selectedChats.includes(c.id))}
        selectedCount={selectedChats.length}
        user={user}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onMute={handleMute}
        onPin={handlePin}
        onMarkRead={handleMarkRead}
        onMarkUnread={handleMarkUnread}
        onBlock={handleBlock}
        onClearChat={handleClearChat}
        onSettingsClick={() => navigate("/settings")}
        isDark={isDark}
      />

      {/* Search */}
      <div style={{ padding: 10 }}>
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* Archived shortcut */}
      <div
        onClick={() => navigate("/archive")}
        style={{
          padding: 10,
          margin: "5px 0",
          background: isDark ? "#333" : "#eee",
          borderRadius: 8,
          cursor: "pointer",
          textAlign: "center",
          fontWeight: "bold",
        }}
      >
        📦 Archived Chats
      </div>

      {/* Chat list */}
      <div style={{ padding: 10 }}>
        {(search ? searchResults : visibleChats).map(chat => {
          const isMuted = chat.mutedUntil && chat.mutedUntil > new Date().getTime();
          const isSelected = selectedChats.includes(chat.id);
          return (
            <div
              key={chat.id}
              onClick={() => selectedChats.length ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`)}
              onContextMenu={e => { e.preventDefault(); toggleSelectChat(chat.id); }}
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

      {/* Floating add friend */}
      <button
        onClick={() => setShowAddFriend(true)}
        style={{
          position: "fixed",
          bottom: 90,
          right: 25,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "#25D366",
          color: "#fff",
          fontSize: 30,
          border: "none",
          cursor: "pointer",
        }}
      >
        +
      </button>

      {showAddFriend && <AddFriendPopup user={user} onClose={() => setShowAddFriend(false)} />}

      {/* Profile uploader */}
      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfileFileChange}
      />

      {/* Bottom nav */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: isDark ? "#1e1e1e" : "#fff",
          padding: "10px 0",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          borderTop: "1px solid rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => navigate("/chat")}>
          <span style={{ fontSize: 26 }}>💬</span>
          <div style={{ fontSize: 12 }}>Chat</div>
        </div>
        <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => navigate("/call-history")}>
          <span style={{ fontSize: 26 }}>📞</span>
          <div style={{ fontSize: 12 }}>Calls</div>
        </div>
      </div>
    </div>
  );
}