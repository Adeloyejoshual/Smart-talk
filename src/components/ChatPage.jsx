// src/components/ChatPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./ChatPage/Header";
import AddFriendPopup from "./ChatPage/AddFriendPopup";

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const { user, profilePic, profileName } = useContext(UserContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const profileInputRef = useRef(null);

  // -------------------- AUTH --------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) return navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  // -------------------- REAL-TIME CHATS --------------------
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

          // get friend info
          const friendId = (chatData.participants || []).find((id) => id !== user.uid);
          if (friendId) {
            try {
              const uDoc = await getDoc(doc(db, "users", friendId));
              if (uDoc.exists()) {
                const udata = uDoc.data();
                chatData.name = udata.name || udata.email || chatData.name;
                chatData.photoURL = udata.profilePic || chatData.photoURL || null;
              }
            } catch (e) {
              console.warn("Failed loading friend info", e);
            }
          }

          // shorten lastMessage preview
          if (chatData.lastMessage) {
            chatData.lastMessageShort =
              chatData.lastMessage.length > 40
                ? chatData.lastMessage.slice(0, 40) + "..."
                : chatData.lastMessage;
          } else {
            chatData.lastMessageShort = "No messages yet";
          }

          return chatData;
        })
      );

      // sort pinned first
      chatList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const aTime = a.lastMessageAt?.seconds
          ? a.lastMessageAt.seconds
          : a.lastMessageAt
          ? new Date(a.lastMessageAt).getTime() / 1000
          : 0;
        const bTime = b.lastMessageAt?.seconds
          ? b.lastMessageAt.seconds
          : b.lastMessageAt
          ? new Date(b.lastMessageAt).getTime() / 1000
          : 0;
        return bTime - aTime;
      });

      setChats(chatList.filter((c) => !c.deleted));
    });

    return () => unsubscribe();
  }, [user]);

  // -------------------- DATE FORMAT --------------------
  const formatDate = (timestamp, isNew = false) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return isNew ? <span style={{ color: "#0d6efd" }}>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    const options = { month: "short", day: "numeric" };
    if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return date.toLocaleDateString(undefined, options);
  };

  // -------------------- CHAT CLICK --------------------
  const handleChatClick = async (chat) => {
    if (selectionMode) return toggleSelectChat(chat.id);

    // mark messages as seen
    try {
      const messagesRef = collection(db, "chats", chat.id, "messages");
      const q = query(messagesRef, where("senderId", "!=", user.uid), where("status", "==", "sent"));
      const snap = await getDocs(q);
      const updates = snap.docs.map((d) => updateDoc(d.ref, { status: "seen" }));
      await Promise.all(updates);

      await updateDoc(doc(db, "chats", chat.id), { lastMessageStatus: "seen" });
    } catch (err) {
      console.warn("Failed marking messages as seen:", err);
    }

    navigate(`/chat/${chat.id}`);
  };

  // -------------------- ADD FRIEND --------------------
  const handleChatCreated = (chatObj) => {
    if (!chatObj || !chatObj.id) return;
    setChats((prev) => {
      if (prev.some((c) => c.id === chatObj.id)) return prev;
      return [chatObj, ...prev];
    });
  };

  // -------------------- CHAT LIST FILTERS --------------------
  const visibleChats = chats.filter((c) => !c.archived);
  const searchResults = chats.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  // -------------------- JSX --------------------
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
        user={user}
        onArchive={async () => selectedChats.forEach(async (id) => updateDoc(doc(db, "chats", id), { archived: true }))}
        onDelete={async () => selectedChats.forEach(async (id) => updateDoc(doc(db, "chats", id), { deleted: true }))}
        onSettingsClick={() => navigate("/settings")}
        selectionMode={selectionMode}
        exitSelectionMode={() => setSelectionMode(false)}
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
        {(search ? searchResults : visibleChats).map((chat) => {
          const isNew = chat.lastMessageStatus === "sent" && chat.lastMessageSender !== user.uid;
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
                background: isNew ? (isDark ? "#1a1a3b" : "#e6f0ff") : "transparent",
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
                  <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
                    {chat.lastMessageShort}
                  </p>
                </div>
              </div>
              <small>{formatDate(chat.lastMessageAt, isNew)}</small>
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
          background: "#0d6efd",
          color: "#fff",
          fontSize: 30,
          border: "none",
          cursor: "pointer",
        }}
      >
        +
      </button>

      {showAddFriend && (
        <AddFriendPopup user={user} onClose={() => setShowAddFriend(false)} onChatCreated={handleChatCreated} />
      )}

      {/* Profile uploader */}
      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
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
        <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => navigate("/settings")}>
          <span style={{ fontSize: 26 }}>⚙️</span>
          <div style={{ fontSize: 12 }}>Settings</div>
        </div>
      </div>
    </div>
  );
}