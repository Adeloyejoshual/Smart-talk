import React, { useState, useEffect } from "react";

export default function SearchMessages({ messages, onClose, onJump }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) return setResults([]);

    const filtered = messages.filter((m) =>
      m.text?.toLowerCase().includes(query.toLowerCase())
    );
    setResults(filtered);
  }, [query]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        width: "100%",
        background: "#fff",
        zIndex: 3000,
        paddingBottom: 10,
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
      }}
    >
      {/* SEARCH BAR */}
      <div style={{ padding: 10, display: "flex", gap: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages..."
          style={{
            flex: 1,
            padding: "10px 15px",
            borderRadius: 30,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        />

        <button
          onClick={onClose}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: "#eee",
            border: "none",
          }}
        >
          Close
        </button>
      </div>

      {/* SEARCH RESULTS */}
      <div style={{ padding: "0 15px", maxHeight: "65vh", overflowY: "auto" }}>
        {results.map((m) => (
          <div
            key={m.id}
            onClick={() => onJump(m.id)}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid #ddd",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14 }}>{m.text}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              {new Date(m.createdAt?.toDate()).toLocaleString()}
            </div>
          </div>
        ))}

        {query && results.length === 0 && (
          <p style={{ textAlign: "center", opacity: 0.6 }}>No results found</p>
        )}
      </div>
    </div>
  );
}