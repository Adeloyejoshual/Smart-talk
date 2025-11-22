import React, { useRef, useEffect, useState } from "react";

const COLORS = {
  primary: "#34B7F1",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  darkText: "#fff",
  lightText: "#000",
  mutedText: "#888",
  edited: "#999",
  reactionBg: "#111",
  statusSent: "#888",
  statusDelivered: "#888",
  statusSeen: "#34B7F1",
};

const SPACING = { sm: 8, borderRadius: 16 };
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({
  message,
  myUid,
  isDark,
  uploadingIds,
  menuOpenFor,
  reactionFor,
  setMenuOpenFor,
  setReactionFor,
  applyReaction,
  replyToMessage,
  editMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  forwardMessage,
  pinMessage,
  copyMessageText,
  handleMsgTouchStart,
  handleMsgTouchMove,
  handleMsgTouchEnd,
  fmtTime,
}) {
  const isMine = message.senderId === myUid;
  const showMenu = menuOpenFor === message.id;
  const showReactionPicker = reactionFor === message.id;
  const time = fmtTime(message.createdAt);

  const containerRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState("above"); // 'above' or 'below'

  // Close menu or reaction picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpenFor(null);
        setReactionFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [setMenuOpenFor, setReactionFor]);

  // Adjust menu position
  useEffect(() => {
    if (showMenu && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuPosition(rect.top > 150 ? "above" : "below"); // if message is low on screen, show above
    }
  }, [showMenu]);

  // Status color
  const getStatusColor = (status) => {
    if (status === "sent") return COLORS.statusSent;
    if (status === "delivered") return COLORS.statusDelivered;
    if (status === "seen") return COLORS.statusSeen;
    return COLORS.mutedText;
  };

  const statusText = isMine
    ? message.status === "sent"
      ? "Sent"
      : message.status === "delivered"
      ? "Delivered"
      : message.status === "seen"
      ? "Seen"
      : ""
    : "";

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
    >
      <div
        onTouchStart={() => handleMsgTouchStart(message)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={(e) => handleMsgTouchEnd(message, e)}
        style={{
          maxWidth: "75%",
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
          boxShadow: isMine
            ? "0 2px 8px rgba(0,0,0,0.25)"
            : "0 1px 3px rgba(0,0,0,0.15)",
          position: "relative",
        }}
      >
        {/* Reply preview */}
        {message.replyTo && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.edited,
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

        {/* Upload progress */}
        {uploadingIds[message.id] != null && (
          <div style={{ marginTop: 4, fontSize: 10, color: COLORS.mutedText }}>
            Uploading: {uploadingIds[message.id]}%
          </div>
        )}

        {/* Time & status */}
        <div
          style={{
            fontSize: 10,
            marginTop: 4,
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            alignItems: "center",
          }}
        >
          {message.edited && <span style={{ color: COLORS.edited }}>(edited)</span>}
          <span style={{ color: isMine ? "#fff" : COLORS.mutedText }}>{time}</span>
          {isMine && statusText && (
            <span style={{ fontWeight: "bold", color: getStatusColor(message.status) }}>
              • {statusText}
            </span>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: -16,
              right: -16,
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
              top: menuPosition === "above" ? -48 : "100%",
              left: "50%",
              transform: "translateX(-50%)",
              background: COLORS.lightCard,
              border: `1px solid ${COLORS.mutedText}`,
              borderRadius: SPACING.borderRadius,
              zIndex: 10,
              minWidth: 140,
              boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            }}
          >
            <button onClick={() => replyToMessage(message)}>Reply</button>
            <button onClick={() => setReactionFor(message.id)}>React</button>
            {isMine && <button onClick={() => editMessage(message)}>Edit</button>}
            {isMine && <button onClick={() => deleteMessageForEveryone(message.id)}>Delete for Everyone</button>}
            <button onClick={() => deleteMessageForMe(message.id)}>Delete for Me</button>
            <button onClick={() => forwardMessage(message)}>Forward</button>
            <button onClick={() => pinMessage(message)}>Pin</button>
            <button onClick={() => copyMessageText(message)}>Copy</button>
            <button onClick={() => setMenuOpenFor(null)}>Close</button>
          </div>
        )}

        {/* Reaction picker */}
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