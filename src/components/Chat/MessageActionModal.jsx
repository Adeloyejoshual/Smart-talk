// src/components/Chat/MessageActionModal.jsx
import React, { useState } from "react";

const COLORS = {
  lightBg: "#fff",
  darkBg: "#222",
  text: "#000",
  darkText: "#fff",
  muted: "#888",
};

const SPACING = { sm: 8, borderRadius: 12 };
const menuBtnStyle = {
  padding: SPACING.sm,
  borderRadius: SPACING.borderRadius,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

export default function MessageActionModal({
  visible,
  onClose,
  onEdit,
  onReply,
  onForward,
  onDelete,
  onCopy,
  onReact,
  isDark,
}) {
  if (!visible) return null;

  const bgColor = isDark ? COLORS.darkBg : COLORS.lightBg;
  const textColor = isDark ? COLORS.darkText : COLORS.text;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        background: bgColor,
        borderRadius: SPACING.borderRadius,
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        zIndex: 100,
        minWidth: 180,
      }}
    >
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onReply}>
        Reply
      </button>
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onEdit}>
        Edit
      </button>
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onForward}>
        Forward
      </button>
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onDelete}>
        Delete
      </button>
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onCopy}>
        Copy
      </button>
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onReact}>
        Add Reaction
      </button>
      <button style={{ ...menuBtnStyle, color: textColor }} onClick={onClose}>
        Close
      </button>
    </div>
  );
}