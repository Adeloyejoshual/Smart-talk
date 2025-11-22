// src/components/Chat/MessageItem.jsx
import React, { useState } from "react";

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };
const COLORS = {
  primary: "#34B7F1",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  darkText: "#fff",
  lightText: "#000",
  mutedText: "#888",
  grayBorder: "rgba(0,0,0,0.06)",
  reactionBg: "#111",
};

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({
  message,
  myUid,
  isDark,
  menuOpenFor,
  setMenuOpenFor,
  reactionFor,
  setReactionFor,
  applyReaction,
  replyToMessage,
  editMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  forwardMessage,
  pinMessage,
}) {
  const [swipeStartX, setSwipeStartX] = useState(null);
  const isMine = message.senderId === myUid;
  const showMenu = menuOpenFor === message.id;
  const showReactionPicker = reactionFor === message.id;

  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const handleTouchStart = () => {
    setSwipeStartX(null);
    setTimeout(() => setMenuOpenFor(message.id), 500);
  };

  const handleTouchMove = (ev) => {
    if (!swipeStartX && ev.touches?.[0]) setSwipeStartX(ev.touches[0].clientX);
  };

  const handleTouchEnd = (ev) => {
    if (!swipeStartX) return;
    const endX = ev.changedTouches?.[0]?.clientX;
    if (endX != null && swipeStartX - endX > 80) replyToMessage(message);
    setSwipeStartX(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine
            ? COLORS.primary
            : isDark
            ? COLORS.darkCard
            : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText,
          cursor: "pointer",
          wordBreak: "break-word",
        }}
      >
        {/* Reply preview */}
        {message.replyTo && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.mutedText,
              borderLeft: `3px solid ${COLORS.mutedText}`,
              paddingLeft: 4,
              marginBottom: 4,
            }}
          >
            {message.replyTo.text || message.replyTo.mediaType}
          </div>
        )}

        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Media */}
        {message.mediaUrl && (
          <div style={{ marginTop: 4 }}>
            {message.mediaType === "image" && (
              <img
                src={message.mediaUrl}
                alt=""
                style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }}
              />
            )}
            {message.mediaType === "video" && (
              <video
                src={message.mediaUrl}
                controls
                style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }}
              />
            )}
            {message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
            {message.mediaType === "pdf" && (
              <a href={message.mediaUrl} target="_blank" rel="noreferrer">
                {message.fileName || "PDF Document"}
              </a>
            )}
          </div>
        )}

        {/* Time & status */}
        <div
          style={{
            fontSize: 10,
            color: COLORS.mutedText,
            marginTop: 2,
            textAlign: "right",
          }}
        >
          {message.edited && "(edited)"} {fmtTime(message.createdAt)}{" "}
          {isMine && message.status ? `• ${message.status}` : ""}
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: -12,
              right: -12,
              display: "flex",
              gap: 2,
            }}
          >
            {Object.values(message.reactions).map(
              (r, i) =>
                r && (
                  <span
                    key={i}
                    style={{
                      backgroundColor: COLORS.reactionBg,
                      color: "#fff",
                      borderRadius: 8,
                      padding: "0 4px",
                      fontSize: 10,
                    }}
                  >
                    {r}
                  </span>
                )
            )}
          </div>
        )}

        {/* Menu */}
        {showMenu && (
          <div
            style={{
              position: "absolute",
              top: -SPACING.lg,
              right: 0,
              background: COLORS.lightCard,
              border: `1px solid ${COLORS.grayBorder}`,
              borderRadius: SPACING.borderRadius,
              zIndex: 10,
            }}
          >
            <button
              style={{ padding: 8, border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left" }}
              onClick={() => replyToMessage(message)}
            >
              Reply
            </button>
            <button
              style={{ padding: 8, border: "none", background: "transparent", cursor: "pointer", width: "100%", textAlign: "left" }}
              onClick={() => setReactionFor(message.id)}
            >
              React
            </button>
            {isMine && (
              <button style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }} onClick={() => editMessage(message)}>
                Edit
              </button>
            )}
            {isMine && (
              <button
                style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }}
                onClick={() => deleteMessageForEveryone(message.id)}
              >
                Delete for Everyone
              </button>
            )}
            <button
              style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }}
              onClick={() => deleteMessageForMe(message.id)}
            >
              Delete for Me
            </button>
            <button
              style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }}
              onClick={() => forwardMessage(message)}
            >
              Forward
            </button>
            <button
              style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }}
              onClick={() => pinMessage(message)}
            >
              Pin
            </button>
            <button
              style={{ padding: 8, border: "none", background: "transparent", width: "100%", textAlign: "left" }}
              onClick={() => setMenuOpenFor(null)}
            >
              Close
            </button>
          </div>
        )}

        {/* Inline reaction picker */}
        {showReactionPicker && (
          <div
            style={{
              position: "absolute",
              bottom: -28,
              left: 0,
              display: "flex",
              gap: 4,
              background: COLORS.lightCard,
              borderRadius: SPACING.borderRadius,
              padding: "2px 4px",
            }}
          >
            {INLINE_REACTIONS.map((r, i) => (
              <span
                key={i}
                style={{ cursor: "pointer", fontSize: 14 }}
                onClick={() => applyReaction(message.id, r)}
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}