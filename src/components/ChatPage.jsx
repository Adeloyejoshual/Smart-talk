// src/components/ChatPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./ChatPage/Header";
import AddFriendPopup from "./ChatPage/AddFriendPopup";

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const { user, profilePic, profileName, uploadProfilePic } = useContext(UserContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const profileInputRef = useRef(null);

  // AUTH
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  // REAL-TIME CHAT LIST
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
            } catch (e) {}
          }

          return chatData;
        })
      );

      // sort pinned first
      chatList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const aTime = a.lastMessageAt?.seconds ? a.lastMessageAt.seconds : 0;
        const bTime = b.lastMessageAt?.seconds ? b.lastMessageAt.seconds : 0;
        return bTime - aTime;
      });

      setChats(chatList.filter(c => !c.deleted));
    });

    return () => unsubscribe();
  }, [user]);

  // Helpers
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

  const handleProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    await uploadProfilePic(file);
  };
  const openProfileUploader = () => profileInputRef.current?.click();

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

  const handlePin = async (chatId) => {
    const pinnedChats = chats.filter(c => c.pinned && c.id !== chatId);
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;
    const currentPinned = chatSnap.data().pinned || false;
    if (!currentPinned && pinnedChats.length >= 3) {
      alert("Max 3 pinned chats");
      return;
    }
    await updateDoc(chatRef, { pinned: !currentPinned });
  };

  // Handle optimistic new friend addition
  const handleChatCreated = (chatObj) => {
    if (!chatObj?.id) return;
    setChats(prev => prev.some(c => c.id === chatObj.id) ? prev : [chatObj, ...prev]);
  };

  const visibleChats = chats.filter(c => !c.archived);
  const searchResults = chats.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      background: wallpaper ? `url(${wallpaper}) no-repeat center/cover` : isDark ? "#121212" : "#fff",
      minHeight: "100vh",
      color: isDark ? "#fff" : "#000",
      paddingBottom: "90px",
    }}>
      <ChatHeader
        selectedChats={chats.filter(c => selectedChats.includes(c.id))}
        user={user}
        onPin={(ids) => selectedChats.forEach(id => handlePin(id))}
        selectionMode={selectionMode}
        exitSelectionMode={exitSelectionMode}
        isDark={isDark}
      />

      {/* Search */}
      <div style={{ padding: 10 }}>
        <input type="text" placeholder="Search chats..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }} />
      </div>

      {/* Chat List */}
      <div style={{ padding: 10 }}>
        {(search ? searchResults : visibleChats).map(chat => {
          const isSelected = selectedChats.includes(chat.id);
          const isMuted = chat.mutedUntil && chat.mutedUntil > new Date().getTime();
          const timeColor = isDark ? "#4dabf7" : "#007bff";

          return (
            <div key={chat.id} onClick={() => selectionMode ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`)}
              onContextMenu={e => { e.preventDefault(); enterSelectionMode(chat.id); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 10,
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
                background: isSelected ? "rgba(0,123,255,0.2)" : isMuted ? (isDark ? "#2c2c2c" : "#f0f0f0") : "transparent",
                opacity: chat.blocked ? 0.5 : 1,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <div style={{ width: 45, height: 45, borderRadius: "50%", overflow: "hidden", background: "#888", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontWeight: "bold" }}>
                  {chat.photoURL ? <img src={chat.photoURL} alt={chat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : chat.name ? chat.name[0].toUpperCase() : "U"}
                </div>

                {/* unread badge */}
                {chat.unreadCount > 0 && <div style={{
                  position: "absolute", top: -5, left: 30, background: "#ff4d4f", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 10, fontWeight: "bold",
                }}>{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</div>}

                <div>
                  <strong>{chat.name}</strong>
                  {chat.pinned && <span style={{ marginLeft: 5 }}>📌</span>}
                  {chat.blocked && <span style={{ marginLeft: 5, color: "red" }}>🚫</span>}
                  <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555", display: "flex", alignItems: "center", gap: 5 }}>
                    {renderMessageTick(chat)} {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>

              <small style={{ color: timeColor }}>{formatDate(chat.lastMessageAt)}</small>
            </div>
          );
        })}
      </div>

      {/* Add Friend */}
      <button onClick={() => setShowAddFriend(true)} style={{ position: "fixed", bottom: 90, right: 25, width: 60, height: 60, borderRadius: "50%", background: "#0d6efd", color: "#fff", fontSize: 30, border: "none", cursor: "pointer" }}>+</button>

      {showAddFriend && <AddFriendPopup user={user} onClose={() => setShowAddFriend(false)} onChatCreated={handleChatCreated} />}

      {/* Profile uploader */}
      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfileFileChange} />
    </div>
  );
}