import React, { useEffect, useState, useContext } from "react";
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isDark = theme === "dark";

  // 🔐 Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else navigate("/");
    });
    return unsubscribe;
  }, [navigate]);

  // 💬 Real-time chat list (with live updates)
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

          // 👤 Fetch friend info (for photo + name)
          const friendId = chatData.participants.find((id) => id !== user.uid);
          if (friendId) {
            const friendRef = doc(db, "users", friendId);
            const friendSnap = await getDocs(query(collection(db, "users"), where("uid", "==", friendId)));
            if (!friendSnap.empty) {
              const data = friendSnap.docs[0].data();
              chatData.name = data.displayName || data.email;
              chatData.photoURL = data.photoURL || "";
            }
          }

          // 🔁 Get last message
          const msgRef = collection(db, "chats", docSnap.id, "messages");
          const msgQ = query(msgRef, orderBy("createdAt", "desc"));
          const msgSnap = await getDocs(msgQ);
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

      // 🧩 Sort by last message time
      chatList.sort((a, b) => {
        const aTime = a.lastMessageAt?.seconds || 0;
        const bTime = b.lastMessageAt?.seconds || 0;
        return bTime - aTime;
      });

      setChats(chatList);
    });

    return () => unsubscribe();
  }, [user]);

  // ➕ Add Friend
  const handleAddFriend = async () => {
    setMessage("");
    setLoading(true);
    try {
      if (!friendEmail || !user) {
        setMessage("Enter a valid email.");
        setLoading(false);
        return;
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", friendEmail.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage("User not found.");
        setLoading(false);
        return;
      }

      const friendDoc = snapshot.docs[0];
      const friendData = friendDoc.data();

      if (friendData.uid === user.uid) {
        setMessage("⚠️ You can’t add yourself.");
        setLoading(false);
        return;
      }

      // Check if chat already exists
      const chatRef = collection(db, "chats");
      const chatQuery = query(chatRef, where("participants", "array-contains", user.uid));
      const existingChats = await getDocs(chatQuery);
      const existingChat = existingChats.docs.find((doc) =>
        doc.data().participants.includes(friendData.uid)
      );

      if (existingChat) {
        setShowAddFriend(false);
        setLoading(false);
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const newChat = await addDoc(chatRef, {
        participants: [user.uid, friendData.uid],
        name: friendData.displayName || friendData.email.split("@")[0],
        photoURL: friendData.photoURL || "",
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });

      setFriendEmail("");
      setShowAddFriend(false);
      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error("Add friend error:", error);
      setMessage("❌ Error adding friend.");
    }
    setLoading(false);
  };

  const openChat = (chatId) => navigate(`/chat/${chatId}`);

  const renderMessageTick = (chat) => {
    const { lastMessageSender, lastMessageStatus } = chat;
    if (lastMessageSender !== user?.uid) return null;
    if (lastMessageStatus === "sent") return "✓";
    if (lastMessageStatus === "delivered") return "✓✓";
    if (lastMessageStatus === "seen")
      return <span style={{ color: "#25D366" }}>✓✓</span>;
    return "";
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
        transition: "0.3s ease",
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
          zIndex: 2,
        }}
      >
        <h2 style={{ margin: 0 }}>Chats</h2>
        <button
          onClick={() => navigate("/settings")}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          ⚙️
        </button>
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
              onClick={() => openChat(chat.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src={chat.photoURL || "https://via.placeholder.com/50"}
                  alt="profile"
                  style={{
                    width: 45,
                    height: 45,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
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
                    {renderMessageTick(chat)}{" "}
                    {chat.lastMessage
                      ? chat.lastMessage.length > 30
                        ? chat.lastMessage.substring(0, 30) + "..."
                        : chat.lastMessage
                      : "No messages yet"}
                  </p>
                </div>
              </div>
              <small style={{ color: "#888" }}>
                {chat.lastMessageAt
                  ? new Date(
                      chat.lastMessageAt.seconds
                        ? chat.lastMessageAt.seconds * 1000
                        : chat.lastMessageAt
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </small>
            </div>
          ))}
      </div>
    </div>
  );
}