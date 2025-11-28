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
  selectionMode,
  exitSelectionMode,
  isDark,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dropdownRef = useRef(null);

  const selectedCount = selectedChats.length;

  // Close dropdowns when clicking outside
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
    exitSelectionMode();
  };

  const handleClearChatClick = () => {
    onClearChat?.();
    triggerToast("Chat cleared");
    exitSelectionMode();
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const confirmDelete = () => {
    onDelete?.();
    triggerToast(`Deleted ${selectedCount} chat${selectedCount > 1 ? "s" : ""}`);
    setShowDeleteConfirm(false);
    exitSelectionMode();
  };

  const handleMuteClick = (durationLabel, durationMs) => {
    onMute?.(durationMs);
    triggerToast(`Muted chat for ${durationLabel}`);
    setShowMuteMenu(false);
    exitSelectionMode();
  };

  const showMarkRead = selectedChats.some(
    (chat) => chat.lastMessageSender !== user?.uid && chat.lastMessageStatus !== "seen"
  );

  const showMarkUnread = selectedChats.some(
    (chat) => chat.lastMessageSender !== user?.uid && chat.lastMessageStatus === "seen"
  );

  const allBlocked = selectedChats.every((c) => c.blocked);
  const blockLabel = allBlocked ? "Unblock" : "Block";

  const pinnedCount = selectedChats.filter((c) => c.pinned).length;

  const handlePinClick = () => {
    onPin?.();
    triggerToast("Chat(s) pinned/unpinned");
    exitSelectionMode();
  };

  return (
    <>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          background: isDark ? "#1e1e1e" : "#075e54",
          color: "#fff",
          padding: "12px 15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          zIndex: 10,
          fontWeight: "bold",
          transition: "all 0.3s ease",
        }}
      >
        {/* Selected count + cancel button */}
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: selectionMode ? 16 : 20,
            transition: "font-size 0.3s ease",
          }}
        >
          {selectionMode && selectedCount ? (
            <>
              {selectedCount} selected
              <span
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                  padding: "0 7px",
                  background: "#fff",
                  color: isDark ? "#075e54" : "#075e54",
                  borderRadius: "50%",
                  lineHeight: 1,
                  fontSize: 16,
                  transition: "all 0.2s ease",
                }}
                onClick={exitSelectionMode}
                title="Cancel selection"
              >
                ×
              </span>
            </>
          ) : (
            "LoeChat"
          )}
        </h2>

        <div style={{ display: "flex", gap: 15, position: "relative", alignItems: "center" }}>
          {selectionMode && selectedCount ? (
            <>
              {/* Multi-select icons */}
              <span
                style={{ cursor: "pointer", fontSize: 18 }}
                onClick={handleArchiveClick}
                title="Archive"
              >
                📦
              </span>
              <span
                style={{ cursor: "pointer", fontSize: 18 }}
                onClick={handleDeleteClick}
                title="Delete"
              >
                🗑️
              </span>
              <span
                style={{ cursor: "pointer", fontSize: 18 }}
                onClick={() => setShowMuteMenu((prev) => !prev)}
                title="Mute"
              >
                🔕
              </span>

              {showMuteMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "35px",
                    right: 0,
                    background: isDark ? "#2c2c2c" : "#fff",
                    color: isDark ? "#fff" : "#000",
                    border: `1px solid ${isDark ? "#444" : "#ccc"}`,
                    borderRadius: 8,
                    boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                    zIndex: 20,
                    minWidth: 140,
                  }}
                >
                  {["1 hour", "23 hours", "1 week"].map((label, i) => (
                    <div
                      key={label}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: i < 2 ? `1px solid ${isDark ? "#444" : "#ddd"}` : "none",
                        transition: "background 0.2s",
                      }}
                      onClick={() =>
                        handleMuteClick(
                          label,
                          label === "1 hour"
                            ? 3600000
                            : label === "23 hours"
                            ? 82800000
                            : 604800000
                        )
                      }
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = isDark ? "#444" : "#f5f5f5")
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              )}

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
                      top: "35px",
                      right: 0,
                      background: isDark ? "#2c2c2c" : "#fff",
                      color: isDark ? "#fff" : "#000",
                      border: `1px solid ${isDark ? "#444" : "#ccc"}`,
                      borderRadius: 8,
                      boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                      zIndex: 20,
                      minWidth: 180,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {showMarkRead && (
                      <div
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          borderBottom: `1px solid ${isDark ? "#444" : "#ddd"}`,
                        }}
                        onClick={() => {
                          onMarkRead?.();
                          setShowDropdown(false);
                          triggerToast("Marked as read");
                        }}
                      >
                        Mark as Read
                      </div>
                    )}
                    {showMarkUnread && (
                      <div
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          borderBottom: `1px solid ${isDark ? "#444" : "#ddd"}`,
                        }}
                        onClick={() => {
                          onMarkUnread?.();
                          setShowDropdown(false);
                          triggerToast("Marked as unread");
                        }}
                      >
                        Mark as Unread
                      </div>
                    )}
                    <div
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${isDark ? "#444" : "#ddd"}`,
                      }}
                      onClick={() => {
                        handlePinClick();
                        setShowDropdown(false);
                      }}
                    >
                      {pinnedCount > 0 ? "Unpin" : "Pin"}
                    </div>
                    <div
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${isDark ? "#444" : "#ddd"}`,
                      }}
                      onClick={() => {
                        onBlock?.();
                        setShowDropdown(false);
                        triggerToast(`${blockLabel}ed user(s)`);
                      }}
                    >
                      {blockLabel}
                    </div>
                    <div
                      style={{ padding: "8px 12px", cursor: "pointer" }}
                      onClick={() => {
                        handleClearChatClick();
                        setShowDropdown(false);
                      }}
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
          <div
            style={{
              background: isDark ? "#2c2c2c" : "#fff",
              padding: 20,
              borderRadius: 8,
              textAlign: "center",
              minWidth: 300,
              color: isDark ? "#fff" : "#000",
            }}
          >
            <p>Are you sure you want to permanently delete this chat?</p>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-around" }}>
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button onClick={confirmDelete} style={{ color: "red" }}>
                Delete
              </button>
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
            animation: "fadeIn 0.3s",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}