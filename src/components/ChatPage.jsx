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
  limit,
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

          // 👤 Fetch friend info
          const friendId = chatData.participants.find((id) => id !== user.uid);
          if (friendId) {
            const friendSnap = await getDocs(
              query(collection(db, "users"), where("uid", "==", friendId))
            );
            if (!friendSnap.empty) {
              const data = friendSnap.docs[0].data();
              chatData.name = data.displayName || data.email;
              chatData.photoURL = data.photoURL || "";
            }
          }

          // 🔁 Fetch last message (only 1)
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
      const snapshot = await getDocs(
        query(usersRef, where("email", "==", friendEmail.trim()))
      );

      if (snapshot.empty) {
        setMessage("User not found.");
        setLoading(false);
        return;
      }

      const friendData = snapshot.docs[0].data();
      if (friendData.uid === user.uid) {
        setMessage("⚠️ You can’t add yourself.");
        setLoading(false);
        return;
      }

      // Check existing chat
      const existingChatsSnap = await getDocs(
        query(
          collection(db, "chats"),
          where("participants", "array-contains", user.uid)
        )
      );
      const existingChat = existingChatsSnap.docs.find((doc) =>
        doc.data().participants.includes(friendData.uid)
      );

      if (existingChat) {
        setShowAddFriend(false);
        setLoading(false);
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const newChat = await addDoc(collection(db, "chats"), {
        participants: [user.uid, friendData.uid],
        name: friendData.displayName || friendData.email.split("@")[0],
        photoURL: friendData.photoURL || "",
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });

      setFriendEmail("");
      setShowAddFriend(false);
      navigate(`/chat/${newChat.id}`);
    } catch (err) {
      console.error("Add friend error:", err);
      setMessage("❌ Error adding friend.");
    }
    setLoading(false);
  };

  const openChat = (chatId) => navigate(`/chat/${chatId}`);

  const renderMessageTick = (chat) => {
    if (chat.lastMessageSender !== user?.uid) return null;
    if (chat.lastMessageStatus === "sent") return "✓";
    if (chat.lastMessageStatus === "delivered") return "✓✓";
    if (chat.lastMessageStatus === "seen")
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
        <div style={{ display: "flex", gap: 15 }}>
          <button
            onClick={() => navigate("/call-history")}
            style={{ background: "transparent", border: "none", fontSize: 18 }}
          >
            📞
          </button>
          <button
            onClick={() => navigate("/settings")}
            style={{ background: "transparent", border: "none", fontSize: 18 }}
          >
            ⚙️
          </button>
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
                      chat.lastMessageAt?.seconds
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

      {/* Floating Add Friend Button */}
      <button
        onClick={() => setShowAddFriend(true)}
        style={{
          position: "fixed",
          bottom: 30,
          right: 30,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "#25D366",
          color: "#fff",
          fontSize: 30,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
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
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              background: isDark ? "#1f1f1f" : "#fff",
              padding: 20,
              borderRadius: 12,
              width: "90%",
              maxWidth: 400,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            }}
          >
            <h3>Add Friend</h3>
            <input
              type="email"
              placeholder="Friend's email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                marginBottom: 10,
              }}
            />
            {message && (
              <p style={{ color: "red", fontSize: 14, marginBottom: 10 }}>{message}</p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddFriend(false)}>Cancel</button>
              <button onClick={handleAddFriend} disabled={loading}>
                {loading ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}