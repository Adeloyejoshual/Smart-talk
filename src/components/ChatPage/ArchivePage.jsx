// src/components/ChatPage/ArchivePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig"; // adjust path if needed
import { ThemeContext } from "../../context/ThemeContext";
import { UserContext } from "../../context/UserContext";

export default function ArchivePage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const { user } = useContext(UserContext);
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const [archivedChats, setArchivedChats] = useState([]);

  // Load archived chats in real-time
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      where("archived", "==", true),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chats = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = { id: docSnap.id, ...docSnap.data() };

          const friendId = chatData.participants.find((id) => id !== user.uid);
          if (friendId) {
            try {
              const uDoc = await getDocs(
                query(collection(db, "users"), where("uid", "==", friendId))
              );
              if (!uDoc.empty) {
                const data = uDoc.docs[0].data();
                chatData.name = data.name || data.email;
                chatData.photoURL = data.profilePic || null;
              }
            } catch (err) {
              console.warn("Failed to fetch friend info:", err);
            }
          }

          return chatData;
        })
      );

      setArchivedChats(chats);
    });

    return () => unsubscribe();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString())
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    if (date.getFullYear() !== now.getFullYear()) return date.toLocaleDateString();
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Open chat and mark new messages as seen
  const handleOpenChat = async (chat) => {
    navigate(`/chat/${chat.id}`);

    try {
      const messagesRef = collection(db, "chats", chat.id, "messages");
      const snap = await getDocs(messagesRef);
      const batchUpdates = snap.docs
        .map((d) => d.data())
        .filter(
          (m) => m.senderId !== user.uid && (m.status === "sent" || m.status === "delivered")
        )
        .map((m) => updateDoc(doc(db, "chats", chat.id, "messages", m.id), { status: "seen" }));

      await Promise.all(batchUpdates);
    } catch (err) {
      console.error("Failed to mark archived messages as seen:", err);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: wallpaper ? `url(${wallpaper}) no-repeat center/cover` : isDark ? "#121212" : "#fff",
        color: isDark ? "#fff" : "#000",
        paddingBottom: "90px",
      }}
    >
      <h2 style={{ padding: 12, borderBottom: isDark ? "1px solid #333" : "1px solid #ccc" }}>
        Archived Chats
      </h2>

      <div style={{ padding: 10 }}>
        {archivedChats.length === 0 && <p>No archived chats</p>}

        {archivedChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => handleOpenChat(chat)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 10,
              borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
              cursor: "pointer",
              opacity: chat.blocked ? 0.5 : 1,
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
                  <img
                    src={chat.photoURL}
                    alt={chat.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : chat.name ? chat.name[0].toUpperCase() : "U"}
              </div>
              <div>
                <strong>{chat.name || "Unknown"}</strong>
                <p style={{ margin: 0, fontSize: 14, color: isDark ? "#ccc" : "#555" }}>
                  {chat.lastMessage || "No messages yet"}
                </p>
              </div>
            </div>
            <small style={{ color: "#888" }}>{formatDate(chat.lastMessageAt)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}