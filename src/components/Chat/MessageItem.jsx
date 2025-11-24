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
  replyToMessage = () => {},
  handleMsgTouchMove = () => {},
  handleMsgTouchEnd = () => {},
  fmtTime = () => "",
}) {
  const isMine = message.senderId === myUid;
  const bubbleRef = useRef(null);

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const longPressTimer = useRef(null);

  const bubbleBg = isMine
    ? isDark
      ? COLORS.myBlueDark
      : COLORS.myBlue
    : isDark
    ? COLORS.otherBubbleDark
    : COLORS.otherBubble;

  const textColor = isMine ? COLORS.textLight : isDark ? COLORS.textLight : COLORS.textDark;

  // --- Long Press Detection ---
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      openActionMenu();
    }, 550);
  };

  const openActionMenu = () => {
    setActionModalVisible(true);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    handleMsgTouchEnd(message);
  };

  // --- Reaction Picker Position ---
  const handleReactClick = () => {
    if (!bubbleRef.current) return;

    const rect = bubbleRef.current.getBoundingClientRect();
    const showAbove = rect.top > window.innerHeight / 2;

    setPickerPosition({
      top: window.scrollY + (showAbove ? rect.top - 70 : rect.bottom + 10),
      left: window.scrollX + rect.left + rect.width * 0.3,
    });

    setPickerVisible(true);
    setActionModalVisible(false);
  };

  // --- Reaction Send ---
  const handleEmojiSelect = async (emoji) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      reactions: arrayUnion({ emoji, uid: myUid }),
    });
    setPickerVisible(false);
  };

  // --- Media Viewer ---
  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const mediaStyle = {
      width: "100%",
      maxHeight: 260,
      borderRadius: 12,
      display: "block",
      marginTop: 6,
    };
    return (
      <div>
        {message.mediaType === "image" && (
          <img
            src={message.mediaUrl}
            style={mediaStyle}
            onClick={() => setViewerOpen(true)}
            alt=""
          />
        )}
        {message.mediaType === "video" && (
          <video
            src={message.mediaUrl}
            controls
            style={mediaStyle}
            onClick={() => setViewerOpen(true)}
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
        position: "relative",
        paddingLeft: isMine ? 30 : 0,
        paddingRight: isMine ? 0 : 30,
      }}
    >
      {/* REACTIONS UNDER BUBBLE (Fixed) */}
      {message.reactions?.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 3,
            paddingLeft: 4,
            paddingRight: 4,
            fontSize: 18,
          }}
        >
          {message.reactions.map((r, i) => (
            <span key={i}>{r.emoji}</span>
          ))}
        </div>
      )}

      {/* MAIN BUBBLE */}
      <div
        ref={bubbleRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          maxWidth: "78%",
          background: bubbleBg,
          padding: "8px 12px",
          borderRadius: SPACING.borderRadius,
          color: textColor,
          boxShadow: `0 4px 10px ${COLORS.shadow}`,
          position: "relative",
          wordBreak: "break-word",
        }}
      >
        {message.text && (
          <div style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.38 }}>
            {message.text}
          </div>
        )}

        {renderMedia()}

        {/* Time */}
        <div
          style={{
            fontSize: 10,
            opacity: 0.7,
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {fmtTime(message.createdAt)}
        </div>
      </div>

      {/* ACTION MENU */}
      {actionModalVisible && (
        <MessageActionModal
          visible={actionModalVisible}
          onClose={() => setActionModalVisible(false)}
          onReply={() => {
            replyToMessage(message);
            setActionModalVisible(false);
          }}
          onEdit={async () => {
            const t = prompt("Edit message", message.text);
            if (t !== null && t !== message.text) {
              await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
                text: t,
                edited: true,
              });
            }
            setActionModalVisible(false);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(message.text || "");
            setActionModalVisible(false);
          }}
          onDelete={() => {}}
          onForward={() => {}}
          onReact={handleReactClick}
          isDark={isDark}
        />
      )}

      {/* EMOJI PICKER */}
      {pickerVisible && (
        <EmojiPicker
          position={pickerPosition}
          onSelect={handleEmojiSelect}
          onClose={() => setPickerVisible(false)}
        />
      )}
    </div>
  );
}