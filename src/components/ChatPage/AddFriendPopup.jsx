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
  const { user, uploadProfilePic } = useContext(UserContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const profileInputRef = useRef(null);

  // ================= AUTH CHECK =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/");
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

          // Load friend profile by document ID (fixed!)
          if (friendId) {
            const friendDoc = await getDoc(doc(db, "users", friendId));
            if (friendDoc.exists()) {
              const data = friendDoc.data();
              chatData.name = data.name || data.email;
              chatData.photoURL = data.profilePic || null;
            } else {
              chatData.name = "Unknown";
              chatData.photoURL = null;
            }
          }

          // Latest message
          const msgSnap = await getDoc(
            query(
              collection(db, "chats", docSnap.id, "messages"),
              orderBy("createdAt", "desc"),
              limit(1)
            )
          ).catch(() => null);

          const latest = msgSnap?.data();
          if (latest) {
            chatData.lastMessage = latest.text || "📷 Photo";
            chatData.lastMessageAt = latest.createdAt;
            chatData.lastMessageSender = latest.senderId;
            chatData.lastMessageStatus = latest.status;
          }

          // If no messages, still show chat (added friend)
          if (!chatData.lastMessage) {
            chatData.lastMessage = "Say hi!";
            chatData.lastMessageAt = chatData.createdAt;
          }

          return chatData;
        })
      );

      // SORT pinned chats on top
      chatList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0);
      });

      setChats(chatList.filter((c) => !c.deleted));
    });

    return () => unsubscribe();
  }, [user]);

  // ================= OPTIMISTIC CHAT ADD =================
  const handleChatCreated = (chat) => {
    setChats((prev) => {
      const exists = prev.find((c) => c.id === chat.id);
      if (exists) return prev;
      return [chat, ...prev];
    });
  };

  // ================= HELPERS =================
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(
      timestamp.seconds ? timestamp.seconds * 1000 : timestamp
    );
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

  const openProfileUploader = () => profileInputRef.current?.click();
  const handleProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    await uploadProfilePic(file);
  };

  // ================= CHAT ACTIONS =================
  const toggleSelectChat = (chatId) => {
    setSelectedChats((prev) => {
      const updated = prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId];
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

  const handleArchive = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { archived: true })));
    exitSelectionMode();
  };

  const handleDelete = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { deleted: true })));
    exitSelectionMode();
  };

  const handlePin = async (chatId) => {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;
    const currentPinned = chatSnap.data().pinned || false;
    await updateDoc(chatRef, { pinned: !currentPinned });
  };

  const visibleChats = chats.filter((c) => !c.archived);
  const searchResults = chats.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        background: wallpaper ? `url(${wallpaper}) no-repeat center/cover` : isDark ? "#121212" : "#fff",
        minHeight: "100vh",
        color: isDark ? "#fff" : "#000",
        paddingBottom: "90px",
      }}
    >
      <ChatHeader
        selectedChats={chats.filter((c) => selectedChats.includes(c.id))}
        user={user}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onPin={(ids) => selectedChats.forEach((id) => handlePin(id))}
        onClearChat={() => {}}
        onSettingsClick={() => navigate("/settings")}
        selectionMode={selectionMode}
        exitSelectionMode={exitSelectionMode}
        isDark={isDark}
      />

      {/* SEARCH */}
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
        {(search ? searchResults : visibleChats).map((chat) => {
          const isSelected = selectedChats.includes(chat.id);

          return (
            <div
              key={chat.id}
              onClick={() => selectionMode ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`)}
              onContextMenu={(e) => {
                e.preventDefault();
                enterSelectionMode(chat.id);
              }}
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
              <div style={{ display: "flex", gap: 10 }}>
                <div
                  style={{
                    width: 45,
                    height: 45,
                    borderRadius: "50%",
                    background: "#888",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {chat.photoURL ? (
                    <img src={chat.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : chat.name ? chat.name[0] : "U"}
                </div>

                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
                    {renderMessageTick(chat)} {chat.lastMessage}
                  </p>
                </div>
              </div>

              <small style={{ color: "#888" }}>{formatDate(chat.lastMessageAt)}</small>
            </div>
          );
        })}
      </div>

      {/* Floating Add Friend Button */}
      <button
        onClick={() => setShowAddFriend(true)}
        style={{
          position: "fixed",
          bottom: 90,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: "50%",
          fontSize: 32,
          background: "#007bff",
          color: "#fff",
          border: "none",
        }}
      >
        +
      </button>

      {showAddFriend && (
        <AddFriendPopup
          user={user}
          onClose={() => setShowAddFriend(false)}
          onChatCreated={handleChatCreated} // optimistic add
        />
      )}

      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfileFileChange}
      />
    </div>
  );
}