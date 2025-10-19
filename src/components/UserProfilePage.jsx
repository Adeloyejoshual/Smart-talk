// UserProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);
  const [sharedMediaCount, setSharedMediaCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    getDoc(userRef).then((snap) => {
      if (snap.exists()) setUser({ id: snap.id, ...snap.data() });
    });

    // Optionally count shared media across chats that include both users (or show a link to media page)
    // This example will leave the heavy query to ChatMediaPage; we just fetch a rough count across messages where sender==userId (could be expensive)
    // (Optional: compute on server and store summary)
    (async () => {
      try {
        // naive: look up messages across chats where this user is sender — expensive; you can replace with server-side aggregation
        // We'll skip heavy counting to avoid cost — you can add a button to go to /media/:chatId from chat screen instead.
      } catch (e) {}
    })();
  }, [userId]);

  if (!user) return <div style={{ padding: 20 }}>Loading profile...</div>;

  return (
    <div style={{ minHeight: "100vh", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#fff", color: isDark ? "#fff" : "#000", paddingBottom: 40 }}>
      <div style={{ padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: isDark ? "#fff" : "#000" }}>←</button>
        <h2 style={{ margin: 0 }}>{user.displayName || "User Profile"}</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
        <img src={user.photoURL || "/default-avatar.png"} alt="profile" style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(0,0,0,0.08)" }} />
        <h3 style={{ marginTop: 12 }}>{user.displayName}</h3>
        <p style={{ color: "#888", marginTop: 6 }}>{formatLastSeen(user.lastSeen, user.isOnline)}</p>
        {user.email && <p style={{ color: isDark ? "#ddd" : "#444", marginTop: 6 }}>{user.email}</p>}

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: isDark ? "#222" : "#fff", color: isDark ? "#fff" : "#000" }}>Close</button>
          {/* If you want to show media of chats that include both users, you'll need chatId — in many apps you pass chatId in nav; else user clicks from chat screen */}
        </div>
      </div>
    </div>
  );
}

/* reuse formatLastSeen from chat page or import from shared util */
function formatLastSeen(lastSeen, isOnline) {
  if (isOnline) return "Online";
  if (!lastSeen) return "";
  const now = new Date();
  const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = (now - last) / 1000;
  const min = Math.floor(diff / 60);
  const hr = Math.floor(min / 60);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (now.toDateString() === last.toDateString()) {
    if (min < 1) return "just now";
    if (min < 60) return `${min} minute${min > 1 ? "s" : ""} ago`;
    return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  }
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}