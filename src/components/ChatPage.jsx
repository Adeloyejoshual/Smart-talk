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
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const navigate = useNavigate();
  const isDark = theme === "dark";
  const longPressTimeout = useRef(null);

  // 🔐 Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) return navigate("/");
      setUser(u);
    });
    return unsubscribe;
  }, [navigate]);

  // 💬 Real-time chat list with unread count (optimized)
  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = { id: docSnap.id, ...docSnap.data() };
          const friendId = chatData.participants.find((id) => id !== user.uid);

          // Get friend info
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
            query(msgRef, orderBy("createdAt", "desc"), serverTimestamp())
          );
          const latest = msgSnap.docs[0]?.data();
          if (latest) {
            chatData.lastMessage = latest.text || "📷 Photo";
            chatData.lastMessageAt = latest.createdAt;
            chatData.lastMessageSender = latest.senderId;
            chatData.lastMessageStatus = latest.status;
          }

          // Unread count
          const unreadSnap = await getDocs(
            query(msgRef, where("status", "==", "sent"), where("senderId", "!=", user.uid))
          );
          chatData.unreadCount = unreadSnap.size;

          return chatData;
        })
      );

      // Sort newest messages first
      chatList.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.seconds - a.lastMessageAt.seconds;
      });

      setChats(chatList);
    });

    return unsubscribe;
  }, [user]);

  const getInitials = (fullName) => {
    if (!fullName) return "U";
    const names = fullName.trim().split(" ").filter(Boolean);
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  const handleAddFriend = async () => {
    if (!friendEmail.trim() || !user) return;
    const email = friendEmail.trim().toLowerCase();

    if (email === user.email.toLowerCase()) {
      alert("❌ You cannot add yourself.");
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(query(usersRef, where("email", "==", email)));

      if (snapshot.empty) {
        setShowAddFriend(false);
        return;
      }

      const friendData = snapshot.docs[0].data();
      const existingSnap = await getDocs(
        query(collection(db, "chats"), where("participants", "array-contains", user.uid))
      );

      const existing = existingSnap.docs.find((d) =>
        d.data().participants.includes(friendData.uid)
      );

      if (existing) {
        setShowAddFriend(false);
        navigate(`/chat/${existing.id}`);
        return;
      }

      const newChat = await addDoc(collection(db, "chats"), {
        participants: [user.uid, friendData.uid],
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });

      setShowAddFriend(false);
      navigate(`/chat/${newChat.id}`);
    } catch (err) {
      console.log("Add friend error:", err);
    }
  };

  const openChat = async (chat) => {
    // Mark messages as seen
    const msgRef = collection(db, "chats", chat.id, "messages");
    const unreadSnap = await getDocs(
      query(msgRef, where("status", "==", "sent"), where("senderId", "!=", user.uid))
    );
    unreadSnap.forEach(async (docu) => {
      const messageRef = doc(db, "chats", chat.id, "messages", docu.id);
      await updateDoc(messageRef, { status: "seen" });
    });

    navigate(`/chat/${chat.id}`);
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

  const handleLongPress = (chat) => {
    if (window.confirm(`Do you want to delete chat with ${chat.name}?`)) {
      const chatRef = doc(db, "chats", chat.id);
      updateDoc(chatRef, { deleted: true });
    }
  };

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
        <h2 style={{ margin: 0 }}>Chats</h2>
        <button
          onClick={() => navigate("/settings")}
          style={{
            fontSize: 24,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          title="Go to Settings"
        >
          ⚙️
        </button>
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

      {/* Chat List */}
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
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
              }}
              onClick={() => openChat(chat)}
              onMouseDown={() => {
                longPressTimeout.current = setTimeout(() => handleLongPress(chat), 700);
              }}
              onMouseUp={() => clearTimeout(longPressTimeout.current)}
              onMouseLeave={() => clearTimeout(longPressTimeout.current)}
              onTouchStart={() => {
                longPressTimeout.current = setTimeout(() => handleLongPress(chat), 700);
              }}
              onTouchEnd={() => clearTimeout(longPressTimeout.current)}
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
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: isDark ? "#ccc" : "#555",
                      fontWeight: chat.unreadCount > 0 ? "bold" : "normal",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {renderMessageTick(chat)} {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <small style={{ color: "#888" }}>{formatDate(chat.lastMessageAt)}</small>
                {chat.unreadCount > 0 && (
                  <span
                    style={{
                      background: "#25D366",
                      color: "#fff",
                      borderRadius: "50%",
                      padding: "2px 6px",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {chat.unreadCount}
                  </span>
                )}
              </div>
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

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: isDark ? "#1f1f1f" : "#fff",
              padding: 20,
              borderRadius: 12,
              width: "90%",
              maxWidth: 400,
            }}
          >
            <h3>Add Friend</h3>
            <input
              type="email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="Email"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
            <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
              <button onClick={() => setShowAddFriend(false)}>Cancel</button>
              <button onClick={handleAddFriend}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 Bottom Navigation Bar */}
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
        <div
          style={{ textAlign: "center", cursor: "pointer" }}
          onClick={() => navigate("/chat")}
        >
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