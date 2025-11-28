// src/components/ChatPage/Header.jsx
import React, { useState, useRef, useEffect } from "react";

export default function ChatHeader({
  selectedCount = 0,
  onArchive,
  onDelete,
  onMute,
  onPin,
  onSettingsClick,
  onMarkRead,
  onMarkUnread,
  onBlock,
  onClearChat,
  isDark,
  selectedChatName = "",
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!dropdownRef.current?.contains(e.target)) {
        setShowDropdown(false);
        setShowMuteMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  // Multi-select actions
  const handleArchiveClick = () => { onArchive?.(); triggerToast("Archived chat(s)"); };
  const handlePinClick = () => { onPin?.(); triggerToast("Chat pinned"); };
  const handleClearChatClick = () => { onClearChat?.(); triggerToast("Chat cleared"); };

  // Delete with confirmation
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete?.();
    triggerToast(`Deleted chat with ${selectedChatName || "user"}`);
    setShowDeleteConfirm(false);
  };

  // Mute durations
  const handleMuteClick = (durationLabel, durationMs) => {
    onMute?.(durationMs);
    triggerToast(`Muted chat for ${durationLabel}`);
    setShowMuteMenu(false);
  };

  return (
    <>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: isDark ? "#1f1f1f" : "#f5f5f5",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 10,
        }}
      >
        <h2>{selectedCount ? `${selectedCount} selected` : "Chats"}</h2>

        <div style={{ display: "flex", gap: 15, position: "relative" }}>
          {selectedCount ? (
            <>
              <span style={{ cursor: "pointer" }} onClick={handleArchiveClick} title="Archive">📦</span>
              <span style={{ cursor: "pointer" }} onClick={handleDeleteClick} title="Delete">🗑️</span>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => setShowMuteMenu((prev) => !prev)}
                title="Mute"
              >
                🔕
              </span>
              {showMuteMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "30px",
                    right: 0,
                    background: isDark ? "#2c2c2c" : "#fff",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    zIndex: 20,
                    minWidth: 140,
                  }}
                >
                  <div style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => handleMuteClick("1 hour", 3600000)}>1 hour</div>
                  <div style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => handleMuteClick("23 hours", 82800000)}>23 hours</div>
                  <div style={{ padding: 10, cursor: "pointer" }} onClick={() => handleMuteClick("1 week", 604800000)}>1 week</div>
                </div>
              )}
              <span style={{ cursor: "pointer" }} onClick={handlePinClick} title="Pin">📌</span>
            </>
          ) : (
            <>
              <span
                style={{ fontSize: 22, cursor: "pointer" }}
                onClick={onSettingsClick}
                title="Settings"
              >
                ⚙️
              </span>

              {/* Three-dot menu */}
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <span
                  style={{ fontSize: 22, cursor: "pointer" }}
                  onClick={() => setShowDropdown((prev) => !prev)}
                  title="More options"
                >
                  ⋮
                </span>
                {showDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "30px",
                      right: 0,
                      background: isDark ? "#2c2c2c" : "#fff",
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                      zIndex: 20,
                      minWidth: 180,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => { onMarkRead?.(); triggerToast("Marked as read"); setShowDropdown(false); }}>Mark as Read</div>
                    <div style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => { onMarkUnread?.(); triggerToast("Marked as unread"); setShowDropdown(false); }}>Mark as Unread</div>
                    <div style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => { onBlock?.(); triggerToast("User blocked"); setShowDropdown(false); }}>Block</div>
                    <div style={{ padding: "10px", cursor: "pointer" }} onClick={() => { handleClearChatClick(); setShowDropdown(false); }}>Clear Chat</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <div style={{ background: isDark ? "#2c2c2c" : "#fff", padding: 20, borderRadius: 8, textAlign: "center", minWidth: 300 }}>
            <p>Are you sure you want to permanently delete this chat?</p>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-around" }}>
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button onClick={confirmDelete} style={{ color: "red" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast popup */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}