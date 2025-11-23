// src/components/Chat/EmojiPicker.jsx
import React, { useState, useRef, useEffect } from "react";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "👏"];
const ALL_EMOJIS = [
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

export default function EmojiPicker({ onSelect, style, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const pickerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 6,
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 1000,
        width: showAll ? "90vw" : "auto",
        maxWidth: 320,
        ...style,
      }}
    >
      {/* Quick reactions row */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", overflowX: "auto", paddingBottom: 4 }}>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            style={{
              fontSize: 22,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
              flex: "0 0 auto",
            }}
          >
            {emoji}
          </button>
        ))}

        {/* Show all toggle */}
        <button
          onClick={() => setShowAll((prev) => !prev)}
          style={{
            fontSize: 18,
            border: "none",
            background: "#f0f0f0",
            borderRadius: "50%",
            width: 28,
            height: 28,
            cursor: "pointer",
            flex: "0 0 auto",
          }}
          title="More"
        >
          +
        </button>
      </div>

      {/* All emojis grid */}
      {showAll && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))",
            gap: 6,
            padding: 6,
            maxHeight: "50vh",
            overflowY: "auto",
            touchAction: "pan-y", // allows smooth swipe scrolling on mobile
          }}
        >
          {ALL_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              style={{
                fontSize: 24,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 4,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
        }
