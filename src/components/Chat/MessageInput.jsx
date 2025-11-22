import React from "react";

const COLORS = {
  primary: "#34B7F1",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  darkText: "#fff",
  lightText: "#000",
  mutedText: "#888",
  edited: "#999",
  reactionBg: "#111",
};

const SPACING = { sm: 8, borderRadius: 12 };
const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({
  message,
  myUid,
  chatId,
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
  fmtTime
}) {
  const isMine = message.senderId === myUid;
  const showMenu = menuOpenFor === message.id;
  const showReactionPicker = reactionFor === message.id;
  const time = fmtTime(message.createdAt);

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
        onTouchStart={() => handleMsgTouchStart(message)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={(e) => handleMsgTouchEnd(message, e)}
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
        {/* Reply */}
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
          style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}
        >
          {message.edited && "(edited)"} {time}{" "}
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
              top: -48,
              right: 0,
              background: COLORS.lightCard,
              border: `1px solid ${COLORS.mutedText}`,
              borderRadius: SPACING.borderRadius,
              zIndex: 10,
            }}
          >
            <button
              onClick={() => replyToMessage(message)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Reply
            </button>
            <button
              onClick={() => setReactionFor(message.id)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              React
            </button>
            {isMine && (
              <button
                onClick={() => editMessage(message)}
                style={{
                  padding: SPACING.sm,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
            )}
            {isMine && (
              <button
                onClick={() => deleteMessageForEveryone(message.id)}
                style={{
                  padding: SPACING.sm,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                Delete for Everyone
              </button>
            )}
            <button
              onClick={() => deleteMessageForMe(message.id)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Delete for Me
            </button>
            <button
              onClick={() => forwardMessage(message)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Forward
            </button>
            <button
              onClick={() => pinMessage(message)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Pin
            </button>
            <button
              onClick={() => copyMessageText(message)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
            <button
              onClick={() => setMenuOpenFor(null)}
              style={{
                padding: SPACING.sm,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Close
            </button>
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