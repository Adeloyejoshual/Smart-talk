// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import MediaViewer from "./MediaViewer"; // full-screen preview component

const SPACING = { xs: 6, sm: 10, md: 14, borderRadius: 18 };
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

const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageItem({
  message,
  myUid,
  isDark = false,
  menuOpenFor,
  setMenuOpenFor,
  reactionFor,
  setReactionFor,
  applyReaction = async () => {},
  replyToMessage = () => {},
  editMessage = () => {},
  deleteMessageForEveryone = () => {},
  deleteMessageForMe = () => {},
  forwardMessage = () => {},
  pinMessage = () => {},
  copyMessageText = () => {},
  uploadProgress = {},
  handleMsgTouchStart = () => {},
  handleMsgTouchMove = () => {},
  handleMsgTouchEnd = () => {},
  fmtTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  },
}) {
  const isMine = message.senderId === myUid;
  const showMenu = menuOpenFor === message.id;
  const showReactionPicker = reactionFor === message.id;

  const bubbleRef = useRef(null);
  const menuRef = useRef(null);
  const reactionRef = useRef(null);

  const [loadingMedia, setLoadingMedia] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    function onDocClick(e) {
      const target = e.target;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        reactionRef.current &&
        !reactionRef.current.contains(target) &&
        bubbleRef.current &&
        !bubbleRef.current.contains(target)
      ) {
        setMenuOpenFor(null);
        setReactionFor(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [setMenuOpenFor, setReactionFor]);

  const bubbleBg = isMine
    ? isDark
      ? COLORS.myBlueDark
      : COLORS.myBlue
    : isDark
    ? COLORS.otherBubbleDark
    : COLORS.otherBubble;

  const textColor = isMine
    ? COLORS.textLight
    : isDark
    ? COLORS.textLight
    : COLORS.textDark;

  const progressKey = message.tempId || message.id;
  const progressPct = uploadProgress?.[progressKey];

  const renderStatus = () => {
    if (!isMine) return null;
    switch (message.status) {
      case "sent":
        return <span style={{ opacity: 0.9 }}>Sent</span>;
      case "delivered":
        return <span style={{ opacity: 0.9 }}>Delivered</span>;
      case "seen":
        return <span style={{ color: COLORS.myBlue, fontWeight: 600 }}>Seen</span>;
      default:
        return null;
    }
  };

  const handleMediaLoad = () => setLoadingMedia(false);

  const renderMediaPreview = () => {
    if (!message.mediaUrl) return null;
    const isPreviewable = ["image", "video"].includes(message.mediaType);

    const mediaStyle = {
      display: "block",
      width: "100%",
      height: "auto",
      borderRadius: 12,
      objectFit: "cover",
      cursor: isPreviewable ? "pointer" : "default",
      position: "relative",
    };

    return (
      <div>
        {message.mediaType === "image" && (
          <img
            src={message.mediaUrl}
            alt={message.fileName || "image"}
            style={mediaStyle}
            onLoad={handleMediaLoad}
            onClick={() => setViewerOpen(true)}
          />
        )}
        {message.mediaType === "video" && (
          <video
            src={message.mediaUrl}
            controls
            style={mediaStyle}
            onLoadedData={handleMediaLoad}
            onClick={() => setViewerOpen(true)}
          />
        )}
        {loadingMedia && isPreviewable && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `3px solid ${isDark ? "#fff" : "#007AFF"}`,
              borderTopColor: "transparent",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
        {viewerOpen && (
          <MediaViewer
            media={message.mediaUrl}
            type={message.mediaType}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.md,
        gap: 6,
        position: "relative",
        paddingLeft: isMine ? 40 : 0,
        paddingRight: isMine ? 0 : 40,
      }}
    >
      <div
        ref={bubbleRef}
        onTouchStart={() => handleMsgTouchStart(message)}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={(e) => handleMsgTouchEnd(message, e)}
        style={{
          display: "inline-block",
          maxWidth: "78%",
          padding: `${SPACING.sm}px ${SPACING.md}px`,
          borderRadius: SPACING.borderRadius,
          background: bubbleBg,
          color: textColor,
          wordBreak: "break-word",
          position: "relative",
          boxShadow: `0 6px 18px ${COLORS.shadow}`,
        }}
      >
        {message.text && (
          <div style={{ fontSize: 15, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
            {message.text}
          </div>
        )}

        {renderMediaPreview()}

        {typeof progressPct === "number" && progressPct >= 0 && progressPct < 100 && (
          <div
            style={{
              width: "100%",
              height: 6,
              background: "rgba(255,255,255,0.12)",
              borderRadius: 6,
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: isMine ? "rgba(255,255,255,0.9)" : COLORS.myBlue,
                borderRadius: 6,
                transition: "width .2s",
              }}
            />
          </div>
        )}

        {/* Time & Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
            fontSize: 11,
            color: isMine ? "rgba(255,255,255,0.85)" : COLORS.muted,
          }}
        >
          <div>{fmtTime(message.createdAt)}</div>
          {isMine && <div>{renderStatus()}</div>}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}