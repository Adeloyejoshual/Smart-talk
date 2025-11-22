// src/components/Chat/ChatHeader.jsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, arrayUnion, arrayRemove, getDocs, query, collection, orderBy, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";

const COLORS = {
  headerBlue: "#1877F2",
  lightCard: "#fff",
  mutedText: "#888",
};
const SPACING = { sm: 8, borderRadius: 12 };
const menuBtnStyle = { padding: SPACING.sm, borderRadius: SPACING.borderRadius, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" };

export default function ChatHeader({ chatInfo, friendInfo, myUid }) {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const clearChat = async () => {
    if (!confirm("Clear chat?")) return;
    try {
      const snap = await getDocs(query(collection(db, "chats", chatInfo.id, "messages"), orderBy("createdAt", "asc")));
      for (const d of snap.docs) await deleteDoc(d.ref);
      setHeaderMenuOpen(false);
      alert("Chat cleared.");
    } catch (err) {
      console.error("clearChat error", err);
      alert("Failed to clear chat.");
    }
  };

  const toggleBlock = async () => {
    if (!chatInfo) return;
    const chatRef = doc(db, "chats", chatInfo.id);
    const blockedBy = chatInfo.blockedBy || [];
    try {
      if (blockedBy.includes(myUid)) {
        await updateDoc(chatRef, { blockedBy: arrayRemove(myUid) });
        alert("You unblocked this chat.");
      } else {
        await updateDoc(chatRef, { blockedBy: arrayUnion(myUid) });
        alert("You blocked this chat.");
      }
    } catch (err) {
      console.error("toggleBlock error", err);
      alert("Failed to update block status.");
    }
    setHeaderMenuOpen(false);
  };

  return (
    <div
      style={{
        height: 56,
        backgroundColor: COLORS.headerBlue,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => friendInfo?.id && navigate(`/UserProfilePage/${friendInfo.id}`)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); navigate(-1); }}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
        >
          ←
        </button>
        <img
          src={friendInfo?.photoURL || "/default-avatar.png"}
          alt=""
          style={{ width: 36, height: 36, borderRadius: "50%" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 600 }}>{friendInfo?.name || "Chat"}</div>
          <div style={{ fontSize: 12, color: COLORS.mutedText }}>
            {friendInfo?.online
              ? "Online"
              : friendInfo?.lastSeen
                ? `Last seen ${(() => {
                    try {
                      const d = friendInfo.lastSeen.toDate ? friendInfo.lastSeen.toDate() : new Date(friendInfo.lastSeen);
                      return d.toLocaleString();
                    } catch {
                      return "unknown";
                    }
                  })()}`
                : "Last seen unavailable"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => navigate("/VoiceCallPage", { state: { friendId: friendInfo?.id, chatId: chatInfo.id } })}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
          title="Voice call"
        >
          📞
        </button>
        <button
          onClick={() => navigate("/VideoCallPage", { state: { friendId: friendInfo?.id, chatId: chatInfo.id } })}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
          title="Video call"
        >
          🎥
        </button>
        <button
          onClick={() => setHeaderMenuOpen(prev => !prev)}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
        >
          ⋮
        </button>
      </div>

      {headerMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 12,
            background: COLORS.lightCard,
            borderRadius: SPACING.borderRadius,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 30,
          }}
        >
          <button style={menuBtnStyle} onClick={clearChat}>Clear Chat</button>
          <button style={menuBtnStyle} onClick={toggleBlock}>
            {(chatInfo?.blockedBy || []).includes(myUid) ? "Unblock" : "Block"}
          </button>
          <button style={menuBtnStyle} onClick={() => setHeaderMenuOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
          }
