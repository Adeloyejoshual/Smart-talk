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
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

// Cloudinary env for avatar upload (optional)
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [profilePic, setProfilePic] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const profileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // 🔐 Auth listener + load profile
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");

      setUser(u);

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfilePic(data.profilePic || null);
        setProfileName(data.name || "");
      }
    });

    return unsubscribe;
  }, [navigate]);

  // 💬 Real-time chat list
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
          }
          return chatData;
        })
      );

      setChats(chatList);
    });

    return () => unsubscribe();
  }, [user]);

  // ➕ Upload avatar to Cloudinary
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error("Cloudinary environment not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );

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
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { profilePic: url, updatedAt: serverTimestamp() });
      setProfilePic(url);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload avatar");
    }
  };

  const openProfileUploader = () => profileInputRef.current?.click();

  // ✅ Initials
  const getInitials = (fullName) => {
    if (!fullName) return "U";
    const names = fullName.trim().split(" ").filter(Boolean);
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  // ➕ Add Friend
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

  // 🏷️ Chat Actions
  const toggleSelectChat = (chatId) => {
    if (selectedChats.includes(chatId)) {
      setSelectedChats(selectedChats.filter((id) => id !== chatId));
    } else {
      setSelectedChats([...selectedChats, chatId]);
    }
  };

  const handleDelete = async () => {
    for (const chatId of selectedChats) {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, { deleted: true });
    }
    setSelectedChats([]);
    setShowDropdown(false);
  };

  const handleArchive = async () => {
    for (const chatId of selectedChats) {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, { archived: true });
    }
    setSelectedChats([]);
    setShowDropdown(false);
    navigate("/archive");
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!dropdownRef.current?.contains(e.target)) {
        setShowDropdown(false);
      }
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
        onContextMenu={(e) => e.preventDefault()} // Disable default context menu
      >
        {selectedChats.length > 0 ? (
          <h2>{selectedChats.length} selected</h2>
        ) : (
          <h2>Chats</h2>
        )}

        <div style={{ display: "flex", gap: 15, position: "relative" }}>
          {selectedChats.length > 0 ? (
            <>
              {/* Dynamic Action Icons */}
              <span style={{ cursor: "pointer" }} onClick={handleArchive}>📦</span>
              <span style={{ cursor: "pointer" }}>🗑️</span>
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
                  <div style={{ padding: 5, cursor: "pointer" }}>Archive</div>
                  <div style={{ padding: 5, cursor: "pointer" }}>Pin</div>
                  <div style={{ padding: 5, cursor: "pointer" }}>Block</div>
                  <div style={{ padding: 5, cursor: "pointer" }}>
                    Mark as read/unread
                  </div>
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

      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleProfileFileChange}
      />

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
                <div>
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

      {/* 🔥 Bottom Navigation Bar (Chat + Call) */}
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