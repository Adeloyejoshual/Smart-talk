// src/components/Chat/ThreeDotMenu.jsx
import React, { useEffect, useRef } from "react";

export default function ThreeDotMenu({
  isOpen,
  anchorRect,
  onClose,
  primaryActions = [],
  moreActions = [],
  expanded = false,
  setExpanded = () => {},
}) {
  const menuRef = useRef();

  // close on outside click or ESC
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Basic placement: if anchorRect given, try align right of it
  const style = {
    position: "absolute",
    right: 12,
    top: (anchorRect && anchorRect.bottom) ? (anchorRect.bottom + 6) : 48,
    background: "#fff",
    color: "#111",
    padding: 8,
    borderRadius: 10,
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    minWidth: 220,
    zIndex: 1200,
  };

  return (
    <div ref={menuRef} style={style} role="menu" aria-modal="false">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {primaryActions.map((a) => (
          <button
            key={a.id}
            onClick={() => { a.action(); onClose(); }}
            style={menuBtnStyle}
            role="menuitem"
          >
            {a.label}
          </button>
        ))}

        {moreActions.length > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{ ...menuBtnStyle, fontWeight: 700 }}
          >
            More…
          </button>
        )}

        {expanded && moreActions.map((a) => (
          <button
            key={a.id}
            onClick={() => { a.action(); onClose(); setExpanded(false); }}
            style={menuBtnStyle}
            role="menuitem"
          >
            {a.label}
          </button>
        ))}

        <div style={{ height: 6 }} />

        <button onClick={onClose} style={{ ...menuBtnStyle, color: "#666" }}>
          Close
        </button>
      </div>
    </div>
  );
}

const menuBtnStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 14,
};