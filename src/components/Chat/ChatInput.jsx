import React, { useRef } from "react";

const SPACING = { sm: 8, borderRadius: 12 };

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  onFilesSelected,
  selectedFiles,
  holdStart,
  holdEnd,
  recording,
  isDark,
}) {
  const fileInputRef = useRef(null);

  return (
    <div
      style={{
        padding: SPACING.sm,
        display: "flex",
        alignItems: "center",
        gap: SPACING.sm,
        borderTop: `1px solid rgba(0,0,0,0.06)`,
        background: isDark ? "#1b1b1b" : "#fff",
        position: "sticky",
        bottom: 0,
        zIndex: 20,
      }}
    >
      {/* Text input */}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message"
        style={{
          flex: 1,
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          border: `1px solid rgba(0,0,0,0.06)`,
          outline: "none",
          background: isDark ? "#0b0b0b" : "#fff",
          color: isDark ? "#fff" : "#000",
        }}
        onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
      />

      {/* File input */}
      <input
        type="file"
        multiple
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={onFilesSelected}
      />
      <button
        onClick={() => fileInputRef.current.click()}
        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18 }}
      >
        📎
      </button>

      {/* Send / Record button */}
      <button
        onMouseDown={holdStart}
        onMouseUp={holdEnd}
        onTouchStart={holdStart}
        onTouchEnd={holdEnd}
        onClick={sendTextMessage}
        style={{ fontSize: 18, background: "transparent", border: "none" }}
      >
        {recording ? "🔴" : "📩"}
      </button>
    </div>
  );
}