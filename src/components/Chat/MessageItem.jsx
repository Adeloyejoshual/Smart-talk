import React, { useRef } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const SPACING = { borderRadius: 16 };
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

export default function MessageItem({
  message,
  myUid,
  chatId,
  isDark = false,
  replyToMessage = () => {},
  handleMsgTouchStart = () => {},
  handleMsgTouchEnd = () => {},
  fmtTime = () => "",
  showPopup,
}) {
  const isMine = message.senderId === myUid;
  const bubbleRef = useRef(null);
  const longPressTimer = useRef(null);
  const audioRef = useRef(null);

  const bubbleBg = isMine
    ? isDark
      ? COLORS.myBlueDark
      : COLORS.myBlue
    : isDark
    ? COLORS.otherBubbleDark
    : COLORS.otherBubble;

  const textColor = isMine ? COLORS.textLight : isDark ? COLORS.textLight : COLORS.textDark;

  // --- Long Press ---
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      if (!bubbleRef.current || !showPopup) return;

      const rect = bubbleRef.current.getBoundingClientRect();
      showPopup({
        position: { top: rect.top + window.scrollY - 60, left: rect.left + rect.width / 2 },
        options: [
          { label: "Reply", action: () => replyToMessage(message) },
          {
            label: "Edit",
            action: async () => {
              if (!message.text) return;
              const t = prompt("Edit message", message.text);
              if (t !== null && t !== message.text) {
                await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
                  text: t,
                  edited: true,
                });
              }
            },
          },
          {
            label: "Delete",
            action: async () => {
              if (!confirm("Delete this message?")) return;
              await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
                deletedFor: arrayUnion(myUid),
              });
            },
          },
          { label: "React", action: handleReactionClick },
        ],
      });
    }, 600);
  };

  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  // --- Reactions ---
  const handleReactionClick = () => {
    if (!bubbleRef.current || !showPopup) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    showPopup({
      position: { top: rect.top + window.scrollY - 50, left: rect.left + rect.width / 2 },
      options: [
        { label: "👍", action: () => addReaction("👍") },
        { label: "❤️", action: () => addReaction("❤️") },
        { label: "😂", action: () => addReaction("😂") },
        { label: "😮", action: () => addReaction("😮") },
        { label: "😢", action: () => addReaction("😢") },
        { label: "👏", action: () => addReaction("👏") },
      ],
    });
  };

  const addReaction = async (emoji) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      reactions: arrayUnion({ emoji, uid: myUid }),
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 8,
        paddingLeft: isMine ? 30 : 0,
        paddingRight: isMine ? 0 : 30,
      }}
      onTouchStart={() => {
        handleMsgTouchStart(message);
        startLongPress();
      }}
      onTouchEnd={() => {
        handleMsgTouchEnd(message);
        cancelLongPress();
      }}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        startLongPress();
      }}
    >
      <div
        ref={bubbleRef}
        style={{
          maxWidth: "78%",
          background: bubbleBg,
          padding: "10px 14px",
          borderRadius: SPACING.borderRadius,
          color: textColor,
          boxShadow: `0 4px 10px ${COLORS.shadow}`,
          position: "relative",
          wordBreak: "break-word",
        }}
      >
        {/* Text message */}
        {message.text && (
          <div style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text}
          </div>
        )}

        {/* Images */}
        {message.mediaType === "image" && message.mediaUrl && (
          <img
            src={message.mediaUrl}
            alt={message.fileName || "image"}
            style={{
              width: "100%",
              marginTop: message.text ? 6 : 0,
              borderRadius: SPACING.borderRadius,
              objectFit: "cover",
            }}
          />
        )}

        {/* Videos */}
        {message.mediaType === "video" && message.mediaUrl && (
          <video
            controls
            style={{
              width: "100%",
              marginTop: message.text ? 6 : 0,
              borderRadius: SPACING.borderRadius,
            }}
            src={message.mediaUrl}
          />
        )}

        {/* Audio / Voice Note */}
        {message.mediaType === "audio" && message.mediaUrl && (
          <audio
            ref={audioRef}
            controls
            style={{ width: "100%", marginTop: message.text ? 6 : 0 }}
            src={message.mediaUrl}
          />
        )}

        {/* Timestamp */}
        <div
          style={{
            fontSize: 10,
            opacity: 0.6,
            position: "absolute",
            bottom: 4,
            right: 8,
          }}
        >
          {fmtTime(message.createdAt)}
          {message.edited && " (edited)"}
        </div>
      </div>

      {/* Reactions */}
      {message.reactions?.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 4, fontSize: 18, flexWrap: "wrap" }}>
          {message.reactions.map((r, i) => (
            <span key={i}>{r.emoji}</span>
          ))}
          <span style={{ cursor: "pointer", opacity: 0.6 }} onClick={handleReactionClick}>
            +
          </span>
        </div>
      )}
    </div>
  );
}