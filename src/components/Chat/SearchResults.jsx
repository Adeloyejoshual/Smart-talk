// src/components/Chat/SearchResults.jsx
import React from "react";
import MessageBubble from "./MessageBubble";

export default function SearchResults({ results, onJumpToMessage }) {
  if (!results || results.length === 0) {
    return <div className="search-empty">No results</div>;
  }

  return (
    <div className="search-results">
      {results.map((msg) => (
        <div
          key={msg.id}
          className="search-result-item"
          onClick={() => onJumpToMessage(msg.id)}
        >
          <MessageBubble message={msg} isSearchPreview />
        </div>
      ))}
    </div>
  );
}
