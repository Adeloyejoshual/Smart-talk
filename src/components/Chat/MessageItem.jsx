// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import MediaViewer from "./MediaViewer";
import MessageActionModal from "./MessageActionModal";
import EmojiPicker from "./EmojiPicker";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";

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

export default function MessageItem({
  message,
  myUid,
  chatId,
  isDark = false,
  uploadProgress = {},
  setActiveMessageForHeader = () => {},
  replyToMessage = () => {},
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
  const bubbleRef = useRef(null);
  const textRef = useRef(null);

  const [loadingMedia, setLoadingMedia] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);

  // emoji picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const bubbleBg = isMine
    ? isDark
      ? COLORS.myBlueDark
      : COLORS.myBlue
    : isDark
    ? COLORS.otherBubbleDark
    : COLORS.otherBubble;

  const textColor = isMine ? COLORS.textLight : isDark ? COLORS.textLight : COLORS.textDark;
  const progressKey = message.tempId || message.id;
  const progressPct = uploadProgress?.[progressKey];

  const maxPreviewLength = 250;

  useEffect(() => {
    if (textRef.current) {
      const fullHeight = textRef.current.scrollHeight;
      const previewHeight = 60;
      setCollapsedHeight(Math.min(fullHeight, previewHeight));
    }
  }, [message.text]);

  const handleMediaLoad = () => setLoadingMedia(false);

  // ---------------- Media Preview ----------------
  const renderMediaPreview = () => {
    if (!message.mediaUrl) return null;
    const isPreviewable = ["image", "video"].includes(message.mediaType);

    const mediaStyle = {
      display: "block",
      width: "100%",
      maxHeight: 250,
      borderRadius: 12,
      objectFit: "cover",
      cursor: isPreviewable ? "pointer" : "default",
      position: "relative",
      marginTop: SPACING.xs,
    };

    return (
      <div style={{ position: "relative" }}>
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
              width: 28,
              height: 28,
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

  // ---------------- Status ----------------
  const renderStatus = () => {
    if (!isMine) return null;
    switch (message.status) {
      case "sent":
        return <span style={{ opacity: 0.8, fontSize: 11 }}>Sent</span>;
      case "delivered":
        return <span style={{ opacity: 0.8, fontSize: 11 }}>Delivered</span>;
      case "seen":
        return <span style={{ color: COLORS.myBlue, fontWeight: 600, fontSize: 11 }}>Seen</span>;
      default:
        return null;
    }
  };

  // ---------------- Long Press ----------------
  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setActionModalVisible(true);
      setActiveMessageForHeader(message);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer);
    handleMsgTouchEnd(message);
  };

  const handleReactClick = () => {
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    const top = rect.top - 250 > 0 ? rect.top - 260 : rect.bottom + 8;
    const left = rect.left;
    setPickerPosition({ top: top + window.scrollY, left: left + window.scrollX });
    setPickerVisible(true);
    setActionModalVisible(false);
  };

  const handleEmojiSelect = async (emoji) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      reactions: arrayUnion({ emoji, uid: myUid }),
    });
    setPickerVisible(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.md,
        gap: SPACING.xs,
        paddingLeft: isMine ? 30 : 0,
        paddingRight: isMine ? 0 : 30,
        position: "relative",
      }}
    >
      {/* Reactions above bubble */}
      {message.reactions?.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 2 }}>
          {message.reactions.map((r, i) => (
            <span key={i} style={{ fontSize: 14 }}>{r.emoji || r}</span>
          ))}
        </div>
      )}

      <div
        ref={bubbleRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: "inline-block",
          maxWidth: "78%",
          padding: `${SPACING.sm}px ${SPACING.md}px`,
          borderRadius: SPACING.borderRadius,
          background: bubbleBg,
          color: textColor,
          wordBreak: "break-word",
          position: "relative",
          boxShadow: `0 4px 10px ${COLORS.shadow}`,
        }}
      >
        {message.text && (
          <div
            ref={textRef}
            style={{
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              overflow: "hidden",
              maxHeight: showFullText ? "none" : collapsedHeight,
              transition: "max-height 0.25s ease",
            }}
          >
            {showFullText
              ? message.text
              : message.text.length > maxPreviewLength
              ? `${message.text.slice(0, maxPreviewLength)}... (${message.text.length} chars)`
              : message.text
            }
            {message.edited && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>(edited)</span>}
          </div>
        )}

        {message.text && message.text.length > maxPreviewLength && (
          <span
            onClick={() => setShowFullText((prev) => !prev)}
            style={{
              color: isMine ? "#fff" : "#007AFF",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
              display: "inline-block",
              marginTop: 2,
            }}
          >
            {showFullText ? "Show less" : "Read more"}
          </span>
        )}

        {renderMediaPreview()}

        {/* Upload progress */}
        {typeof progressPct === "number" && progressPct >= 0 && progressPct < 100 && (
          <div
            style={{
              width: "100%",
              height: 5,
              background: "rgba(255,255,255,0.12)",
              borderRadius: 5,
              marginTop: SPACING.xs,
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: isMine ? "rgba(255,255,255,0.9)" : COLORS.myBlue,
                borderRadius: 5,
                transition: "width .2s",
              }}
            />
          </div>
        )}

        {/* Time & status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            marginTop: SPACING.xs,
            fontSize: 10,
            color: isMine ? "rgba(255,255,255,0.8)" : COLORS.muted,
          }}
        >
          <div>{fmtTime(message.createdAt)}</div>
          {isMine && <div>{renderStatus()}</div>}
        </div>
      </div>

      {/* Action Modal */}
      <MessageActionModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        onEdit={async () => {
          const newText = prompt("Edit your message", message.text);
          if (newText !== null && newText !== message.text) {
            await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
              text: newText,
              edited: true,
              updatedAt: new Date(),
            });
          }
          setActionModalVisible(false);
        }}
        onReply={() => {
          replyToMessage(message);
          setActionModalVisible(false);
        }}
        onCopy={() => {
          navigator.clipboard.writeText(message.text || "");
          setActionModalVisible(false);
        }}
        onReact={handleReactClick}
        isDark={isDark}
      />

      {/* Emoji Picker */}
      {pickerVisible && (
        <EmojiPicker
          position={pickerPosition}
          onSelect={handleEmojiSelect}
          onClose={() => setPickerVisible(false)}
        />
      )}

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