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

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function ArchivePage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const profileInputRef = useRef(null);

  // ================= AUTH =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfilePic(data.profilePic || null);
      }
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
          if (!chatData.archived) return null;

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

  // ================= SELECTION =================
  const toggleSelectChat = (chatId) => {
    setSelectedChats((prev) => {
      const updated = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      setSelectionMode(updated.length > 0);
      return updated;
    });
  };

  const exitSelectionMode = () => {
    setSelectedChats([]);
    setSelectionMode(false);
  };

  // ================= ACTIONS =================
  const handleUnarchive = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { archived: false })));
    exitSelectionMode();
  };

  const handleDelete = async () => {
    await Promise.all(selectedChats.map((id) => updateDoc(doc(db, "chats", id), { deleted: true })));
    exitSelectionMode();
  };

  // ================= CLOUDINARY PROFILE =================
  const uploadToCloudinary = async (file) => {
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

  // ================= RENDER =================
  const filteredChats = search
    ? chats.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.lastMessage?.toLowerCase().includes(search.toLowerCase())
      )
    : chats;

  return (
    <div style={{ background: wallpaper ? `url(${wallpaper}) no-repeat center/cover` : isDark ? "#121212" : "#fff", minHeight: "100vh", color: isDark ? "#fff" : "#000", paddingBottom: "90px" }}>
      
      {/* HEADER */}
      <ChatHeader
        selectedChats={chats.filter(c => selectedChats.includes(c.id))}
        user={{ ...user, profilePic }}
        onArchive={handleUnarchive}
        onDelete={handleDelete}
        selectionMode={selectionMode}
        exitSelectionMode={exitSelectionMode}
        isDark={isDark}
      />

      {/* BACK */}
      <div onClick={() => navigate("/chat")} style={{ padding: 10, cursor: "pointer", fontWeight: "bold" }}>
        ← Back to Chats
      </div>

      {/* SEARCH */}
      <div style={{ padding: 10 }}>
        <input
          type="text"
          placeholder="Search archived chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* CHAT LIST */}
      <div style={{ padding: 10 }}>
        {filteredChats.map((chat) => {
          const isSelected = selectedChats.includes(chat.id);
          return (
            <div
              key={chat.id}
              onClick={() => (selectionMode ? toggleSelectChat(chat.id) : navigate(`/chat/${chat.id}`))}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleSelectChat(chat.id);
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 45, height: 45, borderRadius: "50%", overflow: "hidden", background: "#888", display: "flex", justifyContent: "center", alignItems: "center", color: "#fff", fontWeight: "bold" }}>
                  {chat.photoURL ? <img src={chat.photoURL} alt={chat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : chat.name ? chat.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
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

      {/* PROFILE UPLOADER */}
      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfileFileChange} />
    </div>
  );
}