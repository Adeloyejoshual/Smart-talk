import React, { useRef, useState } from "react";
import MediaViewer from "./MediaViewer";
import EmojiPicker from "./EmojiPicker";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { usePopup } from "../../context/PopupContext";

const SPACING = { xs: 4, sm: 6, md: 8, borderRadius: 14 };
const COLORS = {
  myBlue: "#007AFF",
  myBlueDark: "#0066dd",
  otherBubble: "#f1f0f0",
  otherBubbleDark: "#262626",
  textLight: "#ffffff",
  textDark: "#0b0b0b",
  muted: "#8b8b8b",
  shadow: "rgba(0,0,0,0.12)",
};

export default function MessageItem({ message, myUid, chatId, isDark = false, replyToMessage = () => {}, fmtTime = () => "" }) {
  const isMine = message.senderId === myUid;
  const bubbleRef = useRef(null);
  const { showPopup, closePopup } = usePopup();

  const bubbleBg = isMine ? (isDark ? COLORS.myBlueDark : COLORS.myBlue) : isDark ? COLORS.otherBubbleDark : COLORS.otherBubble;
  const textColor = isMine ? COLORS.textLight : isDark ? COLORS.textLight : COLORS.textDark;

  // --- swipe state ---
  const [translateX, setTranslateX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);

  // --- swipe handlers ---
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!swiping) return;
    const deltaX = e.touches[0].clientX - startX.current;
    if (deltaX > 0 && !isMine) return; // only swipe right to reply on incoming messages
    setTranslateX(deltaX);
  };

  const handleTouchEnd = () => {
    if (translateX > 60) {
      replyToMessage(message); // trigger reply
    }
    setTranslateX(0);
    setSwiping(false);
  };

  // --- Long press opens global popup ---
  const longPressTimer = useRef(null);
  const handleLongPress = () => {
    longPressTimer.current = setTimeout(openActionMenu, 550);
  };
  const handleTouchCancel = () => clearTimeout(longPressTimer.current);

  const openActionMenu = () => {
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    const showAbove = rect.top > window.innerHeight / 2;

    const position = {
      top: window.scrollY + (showAbove ? rect.top - 140 : rect.bottom + 8),
      left: window.scrollX + rect.left + rect.width * 0.3,
    };

    showPopup({
      position,
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => { replyToMessage(message); closePopup(); }}>💬 Reply</button>
          {isMine && <button onClick={async () => {
            const t = prompt("Edit message", message.text);
            if (t !== null && t !== message.text) await updateDoc(doc(db, "chats", chatId, "messages", message.id), { text: t, edited: true });
            closePopup();
          }}>✏️ Edit</button>}
          <button onClick={() => { navigator.clipboard.writeText(message.text || ""); closePopup(); }}>📋 Copy</button>
          {isMine && <button onClick={async () => { await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true }); closePopup(); }}>🗑️ Delete</button>}
          <button onClick={() => handleReactClick(position)}>❤️ React</button>
        </div>
      ),
    });
  };

  const handleReactClick = (position) => {
    showPopup({
      position: { ...position, top: position.top + 50 },
      content: (
        <EmojiPicker
          onSelect={async (emoji) => {
            await updateDoc(doc(db, "chats", chatId, "messages", message.id), { reactions: arrayUnion({ emoji, uid: myUid }) });
            closePopup();
          }}
          onClose={closePopup}
        />
      ),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: SPACING.md, paddingLeft: isMine ? 30 : 0, paddingRight: isMine ? 0 : 30 }}>
      {message.reactions?.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 3, fontSize: 18 }}>
          {message.reactions.map((r, i) => <span key={i}>{r.emoji}</span>)}
        </div>
      )}

      {/* MAIN BUBBLE */}
      <div
        ref={bubbleRef}
        onTouchStart={(e) => { handleTouchStart(e); handleLongPress(); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { handleTouchEnd(); handleTouchCancel(); }}
        style={{
          maxWidth: "78%",
          background: bubbleBg,
          padding: "8px 12px",
          borderRadius: SPACING.borderRadius,
          color: textColor,
          boxShadow: `0 4px 10px ${COLORS.shadow}`,
          position: "relative",
          wordBreak: "break-word",
          transform: `translateX(${translateX}px)`,
          transition: swiping ? "none" : "transform 0.25s ease",
        }}
      >
        {message.text && <div style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.38 }}>{message.text}</div>}

        {message.mediaUrl && (
          <div>
            {message.mediaType === "image" && <img src={message.mediaUrl} style={{ width: "100%", maxHeight: 260, borderRadius: 12, marginTop: 6 }} alt="" />}
            {message.mediaType === "video" && <video src={message.mediaUrl} controls style={{ width: "100%", maxHeight: 260, borderRadius: 12, marginTop: 6 }} />}
          </div>
        )}

        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: "right" }}>{fmtTime(message.createdAt)}</div>
      </div>
    </div>
  );
}