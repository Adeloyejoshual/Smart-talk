// src/components/Chat/MessageItem.jsx
import React, { useState, useRef } from "react";
import MessageActionModal from "./MessageActionModal";
import EmojiPicker from "./EmojiPicker";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const SPACING = { borderRadius: 16 };
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏"];

export default function MessageItem({
  message,
  myUid,
  chatId,
  isDark = false,
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

  const bubbleBg = isMine ? "#dcf8c6" : isDark ? "#262626" : "#fff";
  const textColor = isMine ? "#000" : "#000";

  const handleTouchStart = () => {
    bubbleRef.current && setTimeout(openActionMenu, 550);
  };
  const handleTouchEnd = () => handleMsgTouchEnd(message);
  const openActionMenu = () => setActionModalVisible(true);

  // Send emoji reaction
  const sendReaction = async (emoji) => {
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
      reactions: arrayUnion({ emoji, uid: myUid }),
    });
  };

  // Quick emoji tap
  const handleQuickEmoji = (emoji) => sendReaction(emoji);

  // Open full picker
  const handleOpenPicker = () => {
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    const showAbove = rect.top > window.innerHeight / 2;
    setPickerPosition({
      top: window.scrollY + (showAbove ? rect.top - 70 : rect.bottom + 10),
      left: window.scrollX + rect.left + rect.width * 0.3,
    });
    setPickerVisible(true);
  };

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
    maxWidth: "72%",
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
    whiteSpace: "pre-wrap",
  };

  const textStyle = { fontSize: 15, lineHeight: 1.4 };
  const timeStyle = {
    fontSize: 10,
    opacity: 0.5,
    alignSelf: "flex-end",
    marginTop: 4,
    display: "flex",
    gap: 4,
    fontStyle: message.edited ? "italic" : "normal",
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
      {/* Quick emoji reactions above bubble */}
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {QUICK_EMOJIS.map((e) => (
          <span
            key={e}
            style={{ fontSize: 18, cursor: "pointer" }}
            onClick={() => handleQuickEmoji(e)}
          >
            {e}
          </span>
        ))}
        <span
          style={{ fontSize: 18, cursor: "pointer" }}
          onClick={handleOpenPicker}
        >
          ➕
        </span>
      </div>

      {/* Bubble */}
      <div
        ref={bubbleRef}
        style={bubbleStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleMsgTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {message.text && <div style={textStyle}>{message.text}</div>}
        {renderMedia()}
        {/* Timestamp inside bubble */}
        <div style={timeStyle}>
          <span>{fmtTime(message.createdAt)}</span>
          {message.edited && <span>edited</span>}
        </div>
      </div>

      {/* Reactions under bubble */}
      {message.reactions?.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 2,
            fontSize: 18,
            flexWrap: "wrap",
          }}
        >
          {message.reactions.map((r, i) => (
            <span key={i}>{r.emoji}</span>
          ))}
        </div>
      )}

      {/* Full emoji picker */}
      {pickerVisible && (
        <EmojiPicker
          position={pickerPosition}
          onSelect={sendReaction}
          onClose={() => setPickerVisible(false)}
        />
      )}

      {/* Action modal */}
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
          onReact={handleOpenPicker}
          isDark={isDark}
        />
      )}
    </div>
  );
}