// src/components/ChatPage/Header.jsx
import React, { useState, useEffect, useRef } from "react";

export default function ChatHeader({
  selectedChats = [],
  user,
  onArchive,
  onDelete,
  onMute,
  onPin,
  onMarkRead,
  onMarkUnread,
  onBlock,
  onClearChat,
  onSettingsClick,
  isDark,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dropdownRef = useRef(null);

  const selectedCount = selectedChats.length;

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

  const handleArchiveClick = () => {
    onArchive?.();
    triggerToast("Archived chat(s)");
  };

  const handleClearChatClick = () => {
    onClearChat?.();
    triggerToast("Chat cleared");
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);
  const confirmDelete = () => {
    onDelete?.();
    triggerToast(`Deleted ${selectedCount} chat${selectedCount > 1 ? "s" : ""}`);
    setShowDeleteConfirm(false);
  };

  const handleMuteClick = (durationLabel, durationMs) => {
    onMute?.(durationMs);
    triggerToast(`Muted chat for ${durationLabel}`);
    setShowMuteMenu(false);
  };

  const showMarkRead = selectedChats.some(
    (chat) => chat.lastMessageSender !== user?.uid && chat.lastMessageStatus !== "seen"
  );

  const showMarkUnread = selectedChats.some(
    (chat) => chat.lastMessageSender !== user?.uid && chat.lastMessageStatus === "seen"
  );

  // Block/Unblock label
  const allBlocked = selectedChats.every(c => c.blocked);
  const blockLabel = allBlocked ? "Unblock" : "Block";

  // Pin/Unpin label
  const allPinned = selectedChats.every(c => c.pinned);
  const pinLabel = allPinned ? "Unpin" : "Pin";

  return (
    <>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "#0d6efd",
          color: "#fff",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 10,
          fontWeight: "bold",
        }}
      >
        <h2>{selectedCount ? `${selectedCount} selected` : "LoeChat"}</h2>

        <div style={{ display: "flex", gap: 15, position: "relative" }}>
          {selectedCount ? (
            <>
              {/* Multi-select icons */}
              <span style={{ cursor: "pointer" }} onClick={handleArchiveClick} title="Archive">📦</span>
              <span style={{ cursor: "pointer" }} onClick={handleDeleteClick} title="Delete">🗑️</span>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => setShowMuteMenu(prev => !prev)}
                title="Mute"
              >
                🔕
              </span>
              {showMuteMenu && (
                <div style={{
                  position: "absolute",
                  top: "30px",
                  right: 0,
                  background: "#fff",
                  color: "#000",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  zIndex: 20,
                  minWidth: 140,
                }}>
                  <div style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => handleMuteClick("1 hour", 3600000)}>1 hour</div>
                  <div style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }} onClick={() => handleMuteClick("23 hours", 82800000)}>23 hours</div>
                  <div style={{ padding: 10, cursor: "pointer" }} onClick={() => handleMuteClick("1 week", 604800000)}>1 week</div>
                </div>
              )}

              {/* Three-dot menu */}
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <span
                  style={{ fontSize: 22, cursor: "pointer" }}
                  onClick={() => setShowDropdown(prev => !prev)}
                  title="More options"
                >
                  ⋮
                </span>
                {showDropdown && (
                  <div style={{
                    position: "absolute",
                    top: "30px",
                    right: 0,
                    background: "#fff",
                    color: "#000",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    zIndex: 20,
                    minWidth: 180,
                  }}>
                    {showMarkRead && (
                      <div
                        style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }}
                        onClick={() => { onMarkRead?.(); setShowDropdown(false); triggerToast("Marked as read"); }}
                      >
                        Mark as Read
                      </div>
                    )}
                    {showMarkUnread && (
                      <div
                        style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }}
                        onClick={() => { onMarkUnread?.(); setShowDropdown(false); triggerToast("Marked as unread"); }}
                      >
                        Mark as Unread
                      </div>
                    )}
                    {/* Pin/Unpin */}
                    <div
                      style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }}
                      onClick={() => { onPin?.(); setShowDropdown(false); triggerToast(`${pinLabel}ed chat(s)`); }}
                    >
                      {pinLabel}
                    </div>
                    {/* Block/Unblock */}
                    <div
                      style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #ddd" }}
                      onClick={() => { onBlock?.(); setShowDropdown(false); triggerToast(`${blockLabel}ed user(s)`); }}
                    >
                      {blockLabel}
                    </div>
                    {/* Clear chat */}
                    <div
                      style={{ padding: 10, cursor: "pointer" }}
                      onClick={() => { handleClearChatClick(); setShowDropdown(false); }}
                    >
                      Clear Chat
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span
              style={{ fontSize: 22, cursor: "pointer" }}
              onClick={onSettingsClick}
              title="Settings"
            >
              ⚙️
            </span>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{
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
        }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 8, textAlign: "center", minWidth: 300 }}>
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
        <div style={{
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
        }}>
          {toast}
        </div>
      )}
    </>
  );
}