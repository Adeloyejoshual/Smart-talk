// src/components/Chat/Spinner.jsx
import React from "react";

export default function Spinner({ size = 22, color = "#3b82f6", thickness = 3 }) {
  return (
    <div
      className="animate-spin"
      style={{
        width: size,
        height: size,
        border: `${thickness}px solid rgba(0,0,0,0.1)`,
        borderTopColor: color,
        borderRadius: "50%",
      }}
    />
  );
}