// src/components/PopupMenu.jsx
import React, { useContext, useState } from "react";
import { ThemeContext } from "../context/ThemeContext";

export default function PopupMenu({ items = [], onClose }) {
  const { theme } = useContext(ThemeContext);
  const dark = theme === "dark";
  const [openSub, setOpenSub] = useState(null);

  return (
    <div style={{
      minWidth: 180,
      borderRadius: 12,
      overflow: "hidden",
      background: dark ? "#111" : "#fff",
      color: dark ? "#fff" : "#000",
      boxShadow: dark ? "0 8px 30px rgba(0,0,0,0.6)" : "0 8px 30px rgba(0,0,0,0.12)",
      border: dark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.04)"
    }}>
      {items.map((it, idx) => {
        const hasSub = Array.isArray(it.children) && it.children.length;
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              onClick={() => {
                if (hasSub) {
                  setOpenSub(openSub === idx ? null : idx);
                } else {
                  it.onClick && it.onClick();
                  onClose && onClose();
                }
              }}
              onMouseEnter={() => hasSub && setOpenSub(idx)}
              onMouseLeave={() => hasSub && setOpenSub(null)}
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                width: "100%",
                userSelect: "none"
              }}
            >
              {it.icon && <span style={{ opacity: 0.9 }}>{it.icon}</span>}
              <div style={{ flex: 1 }}>{it.label}</div>
              {hasSub && <span style={{ opacity: 0.6 }}>▸</span>}
            </div>

            {/* Submenu */}
            {hasSub && openSub === idx && (
              <div style={{
                position: "absolute",
                marginLeft: 8,
                marginTop: -8,
                transform: "translateX(100%)",
                background: dark ? "#111" : "#fff",
                borderRadius: 10,
                boxShadow: dark ? "0 6px 22px rgba(0,0,0,0.6)" : "0 6px 22px rgba(0,0,0,0.12)",
                border: dark ? "1px solid rgba(255,255,255,0.03)" : "1px solid rgba(0,0,0,0.06)",
                minWidth: 160,
                zIndex: 20000,
                overflow: "hidden"
              }}>
                {it.children.map((c, ci) => (
                  <div key={ci} onClick={() => { c.onClick && c.onClick(); onClose && onClose(); }}
                    style={{ padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {c.icon && <span style={{ marginRight: 8 }}>{c.icon}</span>}
                    {c.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
