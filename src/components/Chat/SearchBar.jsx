// src/components/Chat/SearchBar.jsx
import React from "react";

export default function SearchBar({ query, setQuery, onClose }) {
  return (
    <div className="search-bar">
      <button className="search-close" onClick={onClose}>←</button>

      <input
        type="text"
        placeholder="Search messages..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
    </div>
  );
}
