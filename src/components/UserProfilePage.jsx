// UserProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

function formatLastSeen(ts, isOnline) {
  if (isOnline) return "Online";
  if (!ts) return "";
  const last = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (now.toDateString() === last.toDateString()) {
    const mins = Math.floor((now - last) / 1000 / 60);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString();
}

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, "users", userId);
    getDoc(ref).then((snap) => { if (snap.exists()) setUser({ id: snap.id, ...snap.data() }); });
  }, [userId]);

  const startCall = (type) => {
    // route to call page, adjust CallPage to accept params
    navigate(`/call?chatId=${userId}&type=${type}`);
  };

  const startChatWith = async () => {
    if (!auth.currentUser) return;
    const me = auth.currentUser.uid;
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", me));
    const snap = await getDocs(q);
    const found = snap.docs.find((d) => d.data().participants.includes(userId));
    if (found) navigate(`/chat/${found.id}`);
    else {
      const newChat = await addDoc(chatsRef, {
        participants: [me, userId],
        name: user?.displayName || "",
        photoURL: user?.photoURL || "",
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
      navigate(`/chat/${newChat.id}`);
    }
  };

  if (!user) return <div style={{ padding: 20 }}>Loading profile...</div>;

  return (
    <div style={{ minHeight: "100vh", background: isDark ? "#121212" : "#fff", color: isDark ? "#fff" : "#000" }}>
      <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #ccc" }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 18 }}>←</button>
        <h2 style={{ margin: 0 }}>{user.displayName || "Profile"}</h2>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img src={user.photoURL || "/default-avatar.png"} alt="profile" style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover" }} />
        <h3 style={{ marginTop: 12 }}>{user.displayName}</h3>
        <p style={{ color: "#888" }}>{formatLastSeen(user.lastSeen, user.isOnline)}</p>
        {user.email && <p style={{ color: isDark ? "#ddd" : "#444" }}>{user.email}</p>}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={startChatWith} style={{ padding: "8px 12px", borderRadius: 8, background: "#007BFF", color: "#fff", border: "none" }}>💬 Start Chat</button>
          <button onClick={() => navigate(`/media/${userId}`)} style={{ padding: "8px 12px", borderRadius: 8 }}>🖼 View Media</button>
          <button onClick={() => startCall("voice")} style={{ padding: "8px 12px", borderRadius: 8 }}>📞 Voice</button>
          <button onClick={() => startCall("video")} style={{ padding: "8px 12px", borderRadius: 8 }}>🎥 Video</button>
        </div>
      </div>
    </div>
  );
}