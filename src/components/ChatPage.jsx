// src/components/ChatPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import ChatHeader from "./ChatPage/Header";

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

  const [toast, setToast] = useState("");
  const [toastAction, setToastAction] = useState(null);
  const [undoQueue, setUndoQueue] = useState([]);

  const profileInputRef = useRef(null);

  // ================= AUTH & LOAD USER =================
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
            const friendSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", friendId))
            );
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
    return names.length > 1
      ? (names[0][0] + names[1][0]).toUpperCase()
      : names[0][0].toUpperCase();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();
    if (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now.getTime() - 86400000);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const toggleSelectChat = (chatId) => {
    setSelectedChats((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  // ================= CLOUDINARY PROFILE UPLOAD =================
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error("Cloudinary env not set");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
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
  const handleArchive = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { archived: true })));
    setSelectedChats([]);
    setToast("Archived chat(s)");
    setTimeout(() => setToast(""), 3000);
  };

  const handlePin = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { pinned: true })));
    setSelectedChats([]);
    setToast("Chat pinned");
    setTimeout(() => setToast(""), 3000);
  };

  const handleMute = async (durationMs) => {
    const mutedUntil = new Date().getTime() + durationMs;
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { mutedUntil })));
    setSelectedChats([]);
    setToast(`Muted chat for ${durationMs / 3600000} hours`);
    setTimeout(() => setToast(""), 3000);
  };

  const handleClearChat = async () => {
    await Promise.all(
      selectedChats.map(async (id) => {
        const messagesRef = collection(db, "chats", id, "messages");
        const snapshot = await getDocs(messagesRef);
        snapshot.forEach(async (msg) => await updateDoc(doc(db, "chats", id, "messages", msg.id), { deleted: true }));
      })
    );
    setSelectedChats([]);
    setToast("Cleared chat(s)");
    setTimeout(() => setToast(""), 3000);
  };

  const handleMarkRead = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { lastMessageStatus: "seen" })));
  };

  const handleMarkUnread = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { lastMessageStatus: "delivered" })));
  };

  const handleBlock = async () => {
    // Add block logic
  };

  // ================= UNDO DELETE =================
  const handleDelete = async () => {
    const deletedChats = selectedChats.map(id => chats.find(c => c.id === id)).filter(Boolean);
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { deleted: true })));
    setUndoQueue(deletedChats);
    setSelectedChats([]);
    setToast(`Deleted chat${deletedChats.length > 1 ? "s" : ""}`);
    setToastAction(() => () => undoDelete(deletedChats));

    setTimeout(() => {
      setUndoQueue([]);
      setToast("");
      setToastAction(null);
    }, 5000);
  };

  const undoDelete = async (deletedChats) => {
    await Promise.all(deletedChats.map((chat) => updateDoc(doc(db, "chats", chat.id), { deleted: false })));
    setUndoQueue([]);
    setToast("Restored chat");
    setToastAction(null);
    setTimeout(() => setToast(""), 3000);
  };

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
        selectedCount={selectedChats.length}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onMute={handleMute}
        onPin={handlePin}
        onSettingsClick={() => navigate("/settings")}
        onMarkRead={handleMarkRead}
        onMarkUnread={handleMarkUnread}
        onBlock={handleBlock}
        onClearChat={handleClearChat}
        isDark={isDark}
        selectedChatName={selectedChats.length === 1 ? chats.find(c => c.id === selectedChats[0])?.name : ""}
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

      {/* Chat List */}
      <div style={{ padding: 10 }}>
        {chats
          .filter(
            (c) =>
              !c.archived &&
              (c.name?.toLowerCase().includes(search.toLowerCase()) ||
                c.lastMessage?.toLowerCase().includes(search.toLowerCase()))
          )
          .map((chat) => {
            const isMuted = chat.mutedUntil && chat.mutedUntil > new Date().getTime();
            return (
              <div
                key={chat.id}
                onClick={() => selectedChats.length ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`)}
                onContextMenu={(e) => { e.preventDefault(); toggleSelectChat(chat.id); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                  borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                  cursor: "pointer",
                  background: selectedChats.includes(chat.id)
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
                    {chat.photoURL ? <img src={chat.photoURL} alt={chat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(chat.name)}
                  </div>
                  <div>
                    <strong>{chat.name || "Unknown"}</strong>
                    {chat.pinned && <span style={{ marginLeft: 5 }}>📌</span>}
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

      {/* Floating Add Friend */}
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

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
          onClick={() => setShowAddFriend(false)}
        >
          <div
            style={{ background: isDark ? "#2c2c2c" : "#fff", padding: 20, borderRadius: 8, minWidth: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add Friend</h3>
            <input type="text" placeholder="Enter user ID or email" style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, border: "1px solid #ccc" }} />
            <button style={{ padding: 10, background: "#25D366", color: "#fff", borderRadius: 6, width: "100%" }}>Add</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>{toast}</span>
          {toastAction && (
            <button
              onClick={toastAction}
              style={{
                background: "transparent",
                color: "#25D366",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Profile uploader */}
      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfileFileChange}
      />

      {/* Bottom Navigation */}
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