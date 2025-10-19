// ChatMediaPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatMediaPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [media, setMedia] = useState([]);

  useEffect(() => {
    if (!chatId) return;
    const loadMedia = async () => {
      // fetch messages of type image or file
      const msgsRef = collection(db, "chats", chatId, "messages");
      const q = query(msgsRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const arr = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.type === "image" || m.type === "file");
      setMedia(arr);
    };
    loadMedia();
  }, [chatId]);

  return (
    <div style={{ minHeight: "100vh", background: wallpaper ? `url(${wallpaper}) center/cover no-repeat` : isDark ? "#121212" : "#fff", color: isDark ? "#fff" : "#000" }}>
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: isDark ? "#fff" : "#000" }}>←</button>
        <h3 style={{ margin: 0 }}>Shared Media</h3>
      </div>

      <div style={{ padding: 12 }}>
        {media.length === 0 && <p style={{ color: "#888" }}>No media found.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {media.map((m) => (
            <div key={m.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#111" }}>
              {m.type === "image" ? (
                <img src={m.fileURL} alt={m.fileName} style={{ width: "100%", height: 140, objectFit: "cover", cursor: "pointer" }} onClick={() => window.open(m.fileURL, "_blank")} />
              ) : (
                <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => window.open(m.fileURL, "_blank")}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>📎</div>
                    <div style={{ marginTop: 6 }}>{m.fileName}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}