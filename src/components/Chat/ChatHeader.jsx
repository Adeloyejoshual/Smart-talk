// src/components/Chat/ChatHeader.jsx
import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";
import { UserContext } from "../../context/UserContext";   // <-- Cloudinary here
import { usePopup } from "../../context/PopupContext";
import { doc, updateDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const COLORS = {
  headerBlue: "#1877F2",
  mutedText: "#dbe7ff",
};

const btnStyle = {
  padding: 8,
  borderRadius: 12,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#fff",
  fontSize: 18,
};

export default function ChatHeader({ chatInfo, friendInfo }) {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { cloudinaryBase } = useContext(UserContext); // <-- Cloudinary URL base
  const { showPopup } = usePopup();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [toast, setToast] = useState(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2300);
  };

  const handleMenuClick = () => setMenuOpen((prev) => !prev);

  // --------------------------
  // BLOCK / UNBLOCK USER
  // --------------------------
  const handleBlock = async () => {
    if (!chatInfo?.id || !friendInfo?.id) return;

    const chatRef = doc(db, "chats", chatInfo.id);
    const blockedBy = chatInfo.blockedBy || [];

    let newBlocked;

    if (blockedBy.includes(friendInfo.id)) {
      newBlocked = blockedBy.filter((id) => id !== friendInfo.id);
      triggerToast("User unblocked");
    } else {
      newBlocked = [...blockedBy, friendInfo.id];
      triggerToast("User blocked");
    }

    await updateDoc(chatRef, { blockedBy: newBlocked });
    setMenuOpen(false);
  };

  // --------------------------
  // CLEAR CHAT
  // --------------------------
  const handleClearChat = async () => {
    if (!chatInfo?.id) return;

    const messagesRef = collection(db, "chats", chatInfo.id, "messages");
    const snap = await getDocs(messagesRef);

    const deleteOps = snap.docs.map((m) => deleteDoc(m.ref));
    await Promise.all(deleteOps);

    triggerToast("Chat cleared!");
    setMenuOpen(false);
  };

  const handleReport = () => {
    triggerToast("User reported.");
    setMenuOpen(false);
  };

  // --------------------------
  // CLOUDINARY PROFILE IMAGE
  // --------------------------
  const profilePic =
    friendInfo?.photoId
      ? `${cloudinaryBase}${friendInfo.photoId}`
      : friendInfo?.photoURL ||
        "/default-avatar.png";

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
      {/* LEFT: Back + Avatar + Name */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => friendInfo?.id && navigate(`/profile/${friendInfo.id}`)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(-1);
          }}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20 }}
        >
          ←
        </button>

        <img
          src={profilePic}
          alt=""
          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {friendInfo?.name || "Chat"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.mutedText }}>
            {friendInfo?.online
              ? "Online"
              : friendInfo?.lastSeen
              ? `Last seen: ${new Date(
                  friendInfo.lastSeen?.toDate
                    ? friendInfo.lastSeen.toDate()
                    : friendInfo.lastSeen
                ).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Last seen unavailable"}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", position: "relative" }}>
        <button
          onClick={() =>
            navigate("/voicecall/" + friendInfo?.id, {
              state: { chatId: chatInfo?.id },
            })
          }
          style={btnStyle}
        >
          📞
        </button>

        <button
          onClick={() =>
            navigate("/videocall/" + friendInfo?.id, {
              state: { chatId: chatInfo?.id },
            })
          }
          style={btnStyle}
        >
          🎥
        </button>

        {/* Menu */}
        <button onClick={handleMenuClick} style={btnStyle}>
          ⋮
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              background: "#fff",
              color: "#000",
              borderRadius: 8,
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              minWidth: 150,
              zIndex: 100,
            }}
          >
            <button
              style={{ padding: 10, background: "transparent", textAlign: "left" }}
              onClick={() => navigate(`/profile/${friendInfo?.id}`)}
            >
              View Profile
            </button>

            <button
              style={{ padding: 10, background: "transparent", textAlign: "left" }}
              onClick={handleClearChat}
            >
              Clear Chat
            </button>

            <button
              style={{ padding: 10, background: "transparent", textAlign: "left" }}
              onClick={handleBlock}
            >
              {chatInfo?.blockedBy?.includes(friendInfo?.id)
                ? "Unblock"
                : "Block"}
            </button>

            <button
              style={{ padding: 10, background: "transparent", textAlign: "left" }}
              onClick={handleReport}
            >
              Report
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            color: "#fff",
            padding: "8px 18px",
            borderRadius: 20,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 999,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}