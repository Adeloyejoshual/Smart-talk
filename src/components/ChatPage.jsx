import React, { useEffect, useState, useContext } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
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

  // 🔐 Listen for auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        loadChats(u.uid);
      } else {
        navigate("/");
      }
    });
    return unsubscribe;
  }, [navigate]);

  // 💬 Load user chats
  const loadChats = (uid) => {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChats(chatList);
    });

    return () => unsub();
  };

  // ➕ Add friend by email
  const handleAddFriend = async () => {
    setMessage("");
    setLoading(true);

    try {
      if (!friendEmail || !user) {
        setMessage("Enter a valid email.");
        setLoading(false);
        return;
      }

      // Check if friend exists in Firestore
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", friendEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage("❌ No user found with that email.");
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
      const chatQuery = query(
        chatRef,
        where("participants", "array-contains", user.uid)
      );
      const existingChats = await getDocs(chatQuery);
      const existingChat = existingChats.docs.find((doc) => {
        const data = doc.data();
        return data.participants.includes(friendData.uid);
      });

      if (existingChat) {
        setMessage("✅ Chat already exists. Opening chat...");
        setShowAddFriend(false);
        setLoading(false);
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat document
      const newChat = await addDoc(chatRef, {
        participants: [user.uid, friendData.uid],
        name: friendData.name || friendData.email.split("@")[0],
        photoURL: friendData.photoURL || "",
        lastMessage: "",
        lastMessageAt: new Date(),
      });

      setMessage("✅ Friend added successfully!");
      setFriendEmail("");
      setShowAddFriend(false);

      // ✅ Go directly to chat
      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error(error);
      setMessage("❌ Error adding friend.");
    }

    setLoading(false);
  };

  // 📱 Open selected chat
  const openChat = (chat) => {
    navigate(`/chat/${chat.id}`);
  };

  const isDark = theme === "dark";

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
      {/* 🟢 Header */}
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

      {/* 👋 Welcome Banner */}
      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "15px 20px",
            borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
          }}
        >
          <img
            src={user.photoURL || "https://via.placeholder.com/50"}
            alt="user"
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <div>
            <h3 style={{ margin: 0 }}>
              Welcome, {user.displayName || user.email.split("@")[0]} 👋
            </h3>
            <small style={{ color: "#888" }}>Ready to start chatting?</small>
          </div>
        </div>
      )}

      {/* 🔍 Search bar */}
      <div style={{ padding: "10px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: isDark ? "#222" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />
      </div>

      {/* 💬 Chat list */}
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
              onClick={() => openChat(chat)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src={chat.photoURL || "https://via.placeholder.com/50"}
                  alt="profile"
                  style={{ width: 45, height: 45, borderRadius: "50%" }}
                />
                <div>
                  <strong>{chat.name || "Unknown"}</strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: isDark ? "#ccc" : "#555",
                    }}
                  >
                    {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>
              <small style={{ color: "#888" }}>
                {chat.lastMessageAt
                  ? new Date(chat.lastMessageAt.seconds * 1000).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" }
                    )
                  : ""}
              </small>
            </div>
          ))}
      </div>

      {/* ➕ Floating button */}
      <button
        onClick={() => setShowAddFriend(true)}
        style={{
          position: "fixed",
          bottom: "80px",
          right: "20px",
          background: "#25D366",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "60px",
          height: "60px",
          fontSize: "28px",
          cursor: "pointer",
          boxShadow: "0 3px 6px rgba(0,0,0,0.3)",
        }}
      >
        +
      </button>

      {/* ⚙️ Floating profile & call buttons */}
      <div
        style={{
          position: "fixed",
          bottom: "10px",
          width: "100%",
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        <button
          onClick={() => navigate("/call")}
          style={navBtnStyle("#007AFF")}
        >
          📞 Call
        </button>
        <button
          onClick={() => navigate("/settings")}
          style={navBtnStyle("#555")}
        >
          👤 Profile
        </button>
      </div>

      {/* 📩 Add Friend Popup */}
      {showAddFriend && (
        <div style={popupOverlay}>
          <div style={popupBox(isDark)}>
            <h3>Add Friend by Email</h3>
            <input
              type="email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="Enter email address"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                marginBottom: "10px",
              }}
            />
            <button
              onClick={handleAddFriend}
              disabled={loading}
              style={{
                width: "100%",
                background: "#25D366",
                color: "white",
                padding: "10px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              {loading ? "Adding..." : "Add Friend"}
            </button>
            {message && <p style={{ marginTop: "10px" }}>{message}</p>}
            <button
              onClick={() => setShowAddFriend(false)}
              style={{
                marginTop: "10px",
                width: "100%",
                background: "#999",
                color: "white",
                padding: "10px",
                border: "none",
                borderRadius: "8px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 💅 Styles
const navBtnStyle = (bg) => ({
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: "20px",
  padding: "10px 20px",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
});

const popupOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const popupBox = (isDark) => ({
  background: isDark ? "#222" : "#fff",
  color: isDark ? "#fff" : "#000",
  padding: "20px",
  borderRadius: "12px",
  width: "90%",
  maxWidth: "400px",
  textAlign: "center",
});