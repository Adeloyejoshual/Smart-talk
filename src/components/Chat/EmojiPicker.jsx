// src/components/Chat/EmojiPicker.jsx
import React, { useEffect, useRef, useState } from "react";

const QUICK = ["❤️", "😂", "👍", "😮", "😢", "🔥", "👏"];
const ALL = [
  "🤔","❤️‍🔥","❤️","👍","👎","🔥","🥰","👏",
  "😁","🍿","😱","🤬","😔","🎉","🤩","🤢",
  "💩","🙏","👌","🕊️","🤡","😐","😏","😍",
  "🐋","🌚","🌭","💯","🤣","⚡","🍌","🏆",
  "💔","😶","😑","🍓","🍾","💋","🖕","😈",
  "😴","😭","🤓","👻","🧑‍💻","👀","🎃","🙈",
  "😇","🥳","🥶","🥲","🫣","🫡","🫠","🫢",
  "🫰","🫱","🫲","🫵","🫴","🫶","🫷","🫸",
  "🌝","🌞","🌛","🌜","🌙","⭐","🌟","☄️",
  "💫","✨","⚡","🔥","❄️","☃️","💥","🌪️"
];

export default function EmojiPicker({ onSelect, onClose, position }) {
  const [showAll, setShowAll] = useState(false);
  const pickerRef = useRef(null);

  // close when clicking outside
  useEffect(() => {
    const close = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      style={{
        position: "absolute",
        top: position?.top ?? -60,
        left: position?.left ?? 0,
        background: "#fff",
        borderRadius: 22,
        padding: 8,
        boxShadow: "0 8px 20px rgba(0,0,0,0.20)",
        zIndex: 2000,
        width: showAll ? "90vw" : "auto",
        maxWidth: 340,
      }}
    >
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 5 }}>
        {QUICK.map((e) => (
          <span key={e} onClick={() => onSelect(e)} style={{ fontSize: 24, padding: 4, cursor: "pointer" }}>
            {e}
          </span>
        ))}
        <span
          onClick={() => setShowAll((x) => !x)}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          +
        </span>
      </div>

      {showAll && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))",
          gap: 8,
          maxHeight: "45vh",
          overflowY: "auto",
          padding: 6,
          touchAction: "pan-y",
        }}>
          {ALL.map((e) => (
            <span key={e} onClick={() => onSelect(e)} style={{ fontSize: 26, cursor: "pointer" }}>{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}