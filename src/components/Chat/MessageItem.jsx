// src/components/Chat/MessageItem.jsx
import React, { useRef } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const SPACING = { xs: 4, sm: 6, md: 8, borderRadius: 16 };
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
  uploadProgress = {},
  replyToMessage = () => {},
  handleMsgTouchStart = () => {},
  handleMsgTouchEnd = () => {},
  fmtTime = () => "",
  showPopup, // Popup context
}) {
  const isMine = message.senderId === myUid;
  const bubbleRef = useRef(null);

  const bubbleBg = isMine
    ? isDark
      ? COLORS.myBlueDark
      : COLORS.myBlue
    : isDark
    ? COLORS.otherBubbleDark
    : COLORS.otherBubble;

  const textColor = isMine ? COLORS.textLight : isDark ? COLORS.textLight : COLORS.textDark;

  // --- Long press / menu ---
  const handleLongPress = () => {
    if (!bubbleRef.current || !showPopup) return;

    const rect = bubbleRef.current.getBoundingClientRect();
    showPopup({
      position: {
        top: rect.top + window.scrollY - 60, // show above bubble
        left: rect.left + rect.width / 2,
      },
      options: [
        {
          label: "Reply",
          action: () => replyToMessage(message),
        },
        {
          label: "Edit",
          action: async () => {
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
        {
          label: "React",
          action: () => handleReactionClick(),
        },
      ],
    });
  };

  // --- Reaction Picker (quick emojis above bubble) ---
  const handleReactionClick = () => {
    if (!bubbleRef.current || !showPopup) return;
    const rect = bubbleRef.current.getBoundingClientRect();

    showPopup({
      position: {
        top: rect.top + window.scrollY - 50, // show above bubble
        left: rect.left + rect.width / 2,
      },
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

  // --- Media rendering ---
  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const style = { width: "100%", maxHeight: 260, borderRadius: 12, marginTop: 6 };
    return message.mediaType === "image" ? (
      <img src={message.mediaUrl} alt="" style={style} />
    ) : (
      <video src={message.mediaUrl} style={style} controls />
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.md,
        paddingLeft: isMine ? 30 : 0,
        paddingRight: isMine ? 0 : 30,
      }}
      onTouchStart={() => handleMsgTouchStart(message)}
      onTouchEnd={() => {
        handleMsgTouchEnd(message);
        handleLongPress();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
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
        {message.text && (
          <div style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text}
          </div>
        )}

        {renderMedia()}

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

      {/* Reactions under bubble */}
      {message.reactions?.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 4,
            fontSize: 18,
            flexWrap: "wrap",
          }}
        >
          {message.reactions.map((r, i) => (
            <span key={i}>{r.emoji}</span>
          ))}
          <span
            style={{ cursor: "pointer", opacity: 0.6 }}
            onClick={handleReactionClick}
          >
            +
          </span>
        </div>
      )}
    </div>
  );
}