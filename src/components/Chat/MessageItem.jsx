import React from "react";

const COLORS = {
  primary: "#34B7F1",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
  darkText: "#fff",
  lightText: "#000",
  mutedText: "#888",
  reactionBg: "#111",
  grayBorder: "rgba(0,0,0,0.06)",
  edited: "#999",
};

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

const menuBtnStyle = {
  padding: SPACING.sm,
  borderRadius: SPACING.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

export default function MessageItem({
  m,
  myUid,
  isDark,
  uploadingIds,
  menuOpenFor,
  setMenuOpenFor,
  reactionFor,
  setReactionFor,
  replyToMessage,
  applyReaction,
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
  const isMine = m.senderId === myUid;
  const showMenu = menuOpenFor === m.id;
  const showReactionPicker = reactionFor === m.id;
  const time = fmtTime(m.createdAt);

  return (
    <div
      key={m.id}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
    >
      <div
        onTouchStart={() => handleMsgTouchStart(m)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={(e) => handleMsgTouchEnd(m, e)}
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : COLORS.lightText,
          cursor: "pointer",
          wordBreak: "break-word",
        }}
      >
        {/* Reply preview */}
        {m.replyTo && (
          <div
            style={{
              fontSize: 12,
              color: COLORS.edited,
              borderLeft: `3px solid ${COLORS.mutedText}`,
              paddingLeft: 4,
              marginBottom: 4,
            }}
          >
            {m.replyTo.text || m.replyTo.mediaType}
          </div>
        )}

        {/* Text */}
        {m.text && <div>{m.text}</div>}

        {/* Media */}
        {m.mediaUrl && (
          <div style={{ marginTop: 4 }}>
            {m.mediaType === "image" && (
              <img src={m.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
            )}
            {m.mediaType === "video" && (
              <video src={m.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
            )}
            {m.mediaType === "audio" && <audio src={m.mediaUrl} controls />}
            {m.mediaType === "pdf" && (
              <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                {m.fileName || "PDF Document"}
              </a>
            )}
          </div>
        )}

        {/* Upload progress */}
        {uploadingIds[m.id] != null && (
          <div style={{ marginTop: 4, fontSize: 10, color: COLORS.mutedText }}>Uploading: {uploadingIds[m.id]}%</div>
        )}

        {/* Time and status */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {m.edited && "(edited)"} {time} {m.status && isMine ? `• ${m.status}` : ""}
        </div>

        {/* Reactions */}
        {Object.keys(m.reactions || {}).length > 0 && (
          <div style={{ position: "absolute", bottom: -12, right: -12, display: "flex", gap: 2 }}>
            {Object.values(m.reactions).map(
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

        {/* Message menu */}
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
            <button style={menuBtnStyle} onClick={() => replyToMessage(m)}>
              Reply
            </button>
            <button style={menuBtnStyle} onClick={() => setReactionFor(m.id)}>
              React
            </button>
            {isMine && <button style={menuBtnStyle} onClick={() => editMessage(m)}>Edit</button>}
            {isMine && <button style={menuBtnStyle} onClick={() => deleteMessageForEveryone(m.id)}>Delete for Everyone</button>}
            <button style={menuBtnStyle} onClick={() => deleteMessageForMe(m.id)}>Delete for Me</button>
            <button style={menuBtnStyle} onClick={() => forwardMessage(m)}>Forward</button>
            <button style={menuBtnStyle} onClick={() => pinMessage(m)}>Pin</button>
            <button style={menuBtnStyle} onClick={() => copyMessageText(m)}>Copy</button>
            <button style={menuBtnStyle} onClick={() => setMenuOpenFor(null)}>Close</button>
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
              <span key={i} style={{ cursor: "pointer", fontSize: 14 }} onClick={() => applyReaction(m.id, r)}>
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}