// src/components/ChatPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
  limit,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [selectedChats, setSelectedChats] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const dropdownRef = useRef(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) return navigate("/");
      setUser(u);
    });
    return unsubscribe;
  }, [navigate]);

  // Load chats in real-time (newest first)
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
          const msgRef = collection(db, "chats", docSnap.id, "messages");
          const msgSnap = await getDocs(
            query(msgRef, orderBy("createdAt", "desc"), limit(1))
          );
          const latest = msgSnap.docs[0]?.data();
          if (latest) {
            chatData.lastMessage = latest.text || "📷 Photo";
            chatData.lastMessageAt = latest.createdAt;
            chatData.lastMessageSender = latest.senderId;
            chatData.lastMessageStatus = latest.status;
            chatData.unread =
              latest.senderId !== user.uid && latest.status !== "seen";
          }

          return chatData;
        })
      );

      chatList.sort((a, b) => {
        const tA = a.lastMessageAt?.seconds || 0;
        const tB = b.lastMessageAt?.seconds || 0;
        return tB - tA;
      });

      setChats(chatList);
    });

    return () => unsubscribe();
  }, [user]);

  // Get initials
  const getInitials = (fullName) => {
    if (!fullName) return "U";
    const names = fullName.trim().split(" ").filter(Boolean);
    return names.length > 1
      ? (names[0][0] + names[1][0]).toUpperCase()
      : names[0][0].toUpperCase();
  };

  // Chat actions
  const toggleSelectChat = (chatId) => {
    setSelectedChats((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleArchive = async () => {
    for (const chatId of selectedChats) {
      await updateDoc(doc(db, "chats", chatId), { archived: true });
    }
    setSelectedChats([]);
    setShowDropdown(false);
    navigate("/archive");
  };

  const handleDelete = async () => {
    for (const chatId of selectedChats) {
      await updateDoc(doc(db, "chats", chatId), { deleted: true });
    }
    setSelectedChats([]);
    setShowDropdown(false);
  };

  const renderMessageTick = (chat) => {
    if (chat.lastMessageSender !== user?.uid) return null;
    if (chat.lastMessageStatus === "sent") return "✓";
    if (chat.lastMessageStatus === "delivered") return "✓✓";
    if (chat.lastMessageStatus === "seen")
      return <span style={{ color: "#25D366" }}>✓✓</span>;
    return "";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        background: wallpaper
          ? `url(${wallpaper}) no-repeat center/cover`
          : isDark
          ? "#121212"
          : "#fff",
        minHeight: "100vh",
        color: isDark ? "#fff" : "#000",
        paddingBottom: "90px",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: isDark ? "#1f1f1f" : "#f5f5f5",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <h2>{selectedChats.length > 0 ? `${selectedChats.length} selected` : "Chats"}</h2>

        <div style={{ display: "flex", gap: 15, position: "relative" }}>
          {selectedChats.length > 0 ? (
            <>
              <span style={{ cursor: "pointer" }} onClick={handleArchive}>📦</span>
              <span style={{ cursor: "pointer" }} onClick={handleDelete}>🗑️</span>
              <span style={{ cursor: "pointer" }}>🔕</span>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                ⋮
              </span>
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    top: 50,
                    right: 0,
                    background: isDark ? "#1f1f1f" : "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    zIndex: 20,
                  }}
                >
                  <div style={{ padding: 5, cursor: "pointer" }}>Pin</div>
                  <div style={{ padding: 5, cursor: "pointer" }}>Block</div>
                  <div style={{ padding: 5, cursor: "pointer" }}>Mark as read/unread</div>
                </div>
              )}
            </>
          ) : (
            <span
              style={{ fontSize: 22, cursor: "pointer" }}
              onClick={() => navigate("/settings")}
            >
              ⚙️
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "10px" }}>
        <input
          type="text"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
      </div>

      {/* Archived Shortcut */}
      <div
        onClick={() => navigate("/archive")}
        style={{
          padding: "10px",
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

      {/* Chat List */}
      <div style={{ padding: "10px" }}>
        {chats
          .filter(
            (c) =>
              !c.archived &&
              (c.name?.toLowerCase().includes(search.toLowerCase()) ||
                c.lastMessage?.toLowerCase().includes(search.toLowerCase()))
          )
          .map((chat) => (
            <div
              key={chat.id}
              onClick={() =>
                selectedChats.length > 0
                  ? toggleSelectChat(chat.id)
                  : navigate(`/chat/${chat.id}`)
              }
              onContextMenu={(e) => {
                e.preventDefault();
                toggleSelectChat(chat.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
                background: selectedChats.includes(chat.id)
                  ? "rgba(0,123,255,0.2)"
                  : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                    <img
                      src={chat.photoURL}
                      alt={chat.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    getInitials(chat.name)
                  )}
                </div>
                <div style={{ position: "relative", flex: 1 }}>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: isDark ? "#ccc" : "#555",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {renderMessageTick(chat)} {chat.lastMessage || "No messages yet"}
                  </p>
                  {/* Blue badge for unread */}
                  {chat.unread && (
                    <span
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#1E90FF",
                      }}
                    />
                  )}
                </div>
              </div>
              <small style={{ color: "#888" }}>{formatDate(chat.lastMessageAt)}</small>
            </div>
          ))}
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

      {/* Bottom Navigation */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: isDark ? "#1e1e1e" : "#ffffff",
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
        <div
          style={{ textAlign: "center", cursor: "pointer" }}
          onClick={() => navigate("/call-history")}
        >
          <span style={{ fontSize: 26 }}>📞</span>
          <div style={{ fontSize: 12 }}>Calls</div>
        </div>
      </div>
    </div>
  );
}