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
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatPage() {
  const { theme, wallpaper } = useContext(ThemeContext);
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isDark = theme === "dark";

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // 🔐 AUTH WATCHER
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else navigate("/");
    });
    return unsub;
  }, []);

  // 💬 LOAD CHATS
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const chatList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const chatData = { id: docSnap.id, ...docSnap.data() };

          // 👤 GET FRIEND UID
          const friendId = chatData.participants.find((id) => id !== user.uid);

          // 👤 FETCH FRIEND DATA (users/uid)
          const friendDoc = await getDocs(
            query(collection(db, "users"), where("uid", "==", friendId))
          );
          if (!friendDoc.empty) {
            const data = friendDoc.docs[0].data();
            chatData.name = data.displayName || data.email;
            chatData.photoURL = data.photoURL || "";
          }

          // 📨 GET LAST MESSAGE (FAST)
          const lastMsgQ = query(
            collection(db, "chats", docSnap.id, "messages"),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const msgSnap = await getDocs(lastMsgQ);
          const last = msgSnap.docs[0]?.data();
          if (last) {
            chatData.lastMessage = last.text || "📷 Photo";
            chatData.lastMessageAt = last.createdAt;
            chatData.lastMessageSender = last.senderId;
            chatData.lastMessageStatus = last.status;
          }

          // 🔢 MESSAGE COUNT
          chatData.messageCount = chatData.messageCount || 0;

          return chatData;
        })
      );

      setChats(chatList);
    });

    return unsub;
  }, [user]);

  // ➕ ADD FRIEND
  const handleAddFriend = async () => {
    setLoading(true);
    setMessage("");

    try {
      if (!friendEmail) {
        setMessage("Enter a valid email");
        setLoading(false);
        return;
      }

      // 🧍 FIND USER BY EMAIL
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", friendEmail.trim())
      );
      const userSnap = await getDocs(userQuery);

      if (userSnap.empty) {
        setMessage("User not found");
        setLoading(false);
        return;
      }

      const friendData = userSnap.docs[0].data();
      const friendId = friendData.uid;

      if (friendId === user.uid) {
        setMessage("You cannot add yourself");
        setLoading(false);
        return;
      }

      // 🔎 CHECK IF CHAT EXISTS
      const existingQuery = query(
        collection(db, "chats"),
        where("participants", "in", [
          [user.uid, friendId],
          [friendId, user.uid],
        ])
      );
      const existSnap = await getDocs(existingQuery);

      if (!existSnap.empty) {
        navigate(`/chat/${existSnap.docs[0].id}`);
        setShowAddFriend(false);
        setLoading(false);
        return;
      }

      // 🆕 CREATE CHAT
      const newChat = await addDoc(collection(db, "chats"), {
        participants: [user.uid, friendId],
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });

      setShowAddFriend(false);
      setFriendEmail("");
      navigate(`/chat/${newChat.id}`);
    } catch (e) {
      setMessage("Error adding friend");
      console.log(e);
    }

    setLoading(false);
  };

  const messageTick = (chat) => {
    if (chat.lastMessageSender !== user?.uid) return null;
    if (chat.lastMessageStatus === "sent") return "✓";
    if (chat.lastMessageStatus === "delivered") return "✓✓";
    if (chat.lastMessageStatus === "seen")
      return <span style={{ color: "#25D366" }}>✓✓</span>;
  };

  const openChat = (id) => navigate(`/chat/${id}`);

  return (
    <div
      style={{
        background: wallpaper
          ? `url(${wallpaper})`
          : isDark
          ? "#121212"
          : "#fff",
        minHeight: "100vh",
        paddingBottom: "90px",
        transition: "0.3s",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          padding: "15px",
          display: "flex",
          justifyContent: "space-between",
          background: isDark ? "#1f1f1f" : "#f6f6f6",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          zIndex: 10,
        }}
      >
        <h2 style={{ margin: 0 }}>Chats</h2>
      </div>

      {/* CHAT LIST */}
      <div style={{ padding: 10 }}>
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => openChat(chat.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: isDark ? "1px solid #333" : "1px solid #eee",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img
                src={chat.photoURL || "/default.png"}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />

              <div>
                <strong>{chat.name}</strong>

                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: isDark ? "#ccc" : "#555",
                    display: "flex",
                    gap: 6,
                  }}
                >
                  {messageTick(chat)}
                  {chat.lastMessage
                    ? chat.lastMessage.length > 32
                      ? chat.lastMessage.substring(0, 32) + "..."
                      : chat.lastMessage
                    : "No messages yet"}
                </p>
              </div>
            </div>

            {/* DATE */}
            <small style={{ color: "#888" }}>
              {formatLastMessageTime(chat.lastMessageAt)}
            </small>
          </div>
        ))}
      </div>

      {/* ➕ FLOATING ADD BUTTON */}
      <button
        onClick={() => setShowAddFriend(true)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 90,
          width: 60,
          height: 60,
          borderRadius: "50%",
          fontSize: 30,
          border: "none",
          color: "#fff",
          background: "#007bff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        +
      </button>

      {/* BOTTOM NAV */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          width: "100%",
          padding: "12px 0",
          background: isDark ? "#1f1f1f" : "#fafafa",
          display: "flex",
          justifyContent: "space-around",
          boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <button onClick={() => navigate("/settings")}>👤</button>
        <button onClick={() => navigate("/call-history")}>📞</button>
      </div>

      {/* ADD FRIEND POPUP */}
      {showAddFriend && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "85%",
              background: isDark ? "#222" : "#fff",
              padding: 20,
              borderRadius: 12,
            }}
          >
            <h3>Add Friend</h3>
            <input
              type="email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="Enter email"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
            <p style={{ color: "red", marginTop: 8 }}>{message}</p>

            <button
              onClick={handleAddFriend}
              disabled={loading}
              style={{
                marginTop: 10,
                width: "100%",
                padding: 12,
                background: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: 8,
              }}
            >
              {loading ? "Adding..." : "Add Friend"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}