// src/components/Chat/MessageItem.jsx
import React, { useState, useRef } from "react";
import MessageActionModal from "./MessageActionModal";
import EmojiPicker from "./EmojiPicker";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const SPACING = { borderRadius: 16 };

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
  const [hovered, setHovered] = useState(false);

  const longPressTimer = useRef(null);

  const bubbleBg = isMine ? "#dcf8c6" : isDark ? "#262626" : "#fff";
  const textColor = isMine ? "#000" : "#000";

  // --- Long Press ---
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(openActionMenu, 550);
  };
  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    handleMsgTouchEnd(message);
  };
  const openActionMenu = () => setActionModalVisible(true);

  // --- Reaction Picker ---
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

  const handleEmojiSelect = async (emoji) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      reactions: arrayUnion({ emoji, uid: myUid }),
    });
    setPickerVisible(false);
  };

  // --- Media ---
  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const style = {
      width: "100%",
      maxWidth: "72vw",
      maxHeight: 260,
      borderRadius: 12,
      display: "block",
      marginTop: 6,
      cursor: "pointer",
      objectFit: "cover",
    };
    return message.mediaType === "image" ? (
      <img src={message.mediaUrl} alt="" style={style} />
    ) : (
      <video src={message.mediaUrl} style={style} controls />
    );
  };

  const bubbleStyle = {
    display: "inline-flex",
    flexDirection: "column",
    maxWidth: "72%", // max width for long messages
    alignSelf: isMine ? "flex-end" : "flex-start",
    backgroundColor: bubbleBg,
    color: textColor,
    borderRadius: SPACING.borderRadius,
    padding: "8px 12px",
    margin: "4px 0",
    boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
    position: "relative",
    wordBreak: "break-word",
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "pre-wrap",
  };

  const textStyle = { fontSize: 15, lineHeight: 1.4 };
  const timeStyle = {
    fontSize: 10,
    opacity: hovered ? 0.8 : 0.5,
    alignSelf: "flex-end",
    marginTop: 4,
    display: "flex",
    gap: 4,
    fontStyle: message.edited ? "italic" : "normal",
    transition: "opacity 0.2s ease",
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
    >
      {/* Bubble */}
      <div
        ref={bubbleRef}
        style={bubbleStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {message.text && <div style={textStyle}>{message.text}</div>}
        {renderMedia()}
        {/* Timestamp + Edited */}
        <div style={timeStyle}>
          <span>{fmtTime(message.createdAt)}</span>
          {message.edited && <span>edited</span>}
        </div>
      </div>

      {/* Reactions */}
      {message.reactions?.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 2, fontSize: 18 }}>
          {message.reactions.map((r, i) => (
            <span key={i}>{r.emoji}</span>
          ))}
        </div>
      )}

      {/* Action Modal */}
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

      {/* Emoji Picker */}
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