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
    return names.length > 1
      ? (names[0][0] + names[1][0]).toUpperCase()
      : names[0][0].toUpperCase();
  };

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

  // ================= PROFILE UPLOAD =================
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

  // ================= PIN =================
  const handlePin = async () => {
    const pinnedChats = chats.filter(c => c.pinned === true);

    const tryingToPin = selectedChats.some(id => {
      const chat = chats.find(c => c.id === id);
      return chat && !chat.pinned;
    });

    if (tryingToPin && pinnedChats.length >= 3) {
      alert("You can only pin up to 3 chats");
      return;
    }

    await Promise.all(
      selectedChats.map(async (id) => {
        const chat = chats.find(c => c.id === id);
        if (!chat) return;
        await updateDoc(doc(db, "chats", id), { pinned: !chat.pinned });
      })
    );
    setSelectedChats([]);
  };

  // ================= BLOCK/UNBLOCK =================
  const handleBlock = async () => {
    await Promise.all(
      selectedChats.map(async (id) => {
        const chat = chats.find(c => c.id === id);
        if (!chat) return;
        await updateDoc(doc(db, "chats", id), { blocked: !chat.blocked });
      })
    );
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
      <ChatHeader
        selectedChats={chats.filter((c) => selectedChats.includes(c.id))}
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

      {/* ... rest of ChatPage JSX (search, chat list, add friend, profile upload, bottom nav) ... */}
    </div>
  );
}