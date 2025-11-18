import React from "react";

const EmojiPicker = ({ isDark, extendedEmojis, onSelect, onClose }) => {
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, top: 0, bottom: 0,
      background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", zIndex: 999
    }}>
      <div style={{
        width: "100%", maxHeight: "45vh", background: isDark ? "#0b0b0b" : "#fff",
        borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 12, overflowY: "auto"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8 }}>
          {extendedEmojis.map(e => (
            <button
              key={e}
              onClick={() => onSelect(e)}
              style={{ padding: 10, fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}
            >
              {e}
            </button>
          ))}
        </div>
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ddd" }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;