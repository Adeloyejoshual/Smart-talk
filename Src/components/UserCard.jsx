import React from "react";

export default function UserCard({ user, onClick }) {
  return (
    <div
      onClick={() => onClick(user)}
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "10px",
        marginBottom: "10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <strong>{user.displayName || user.name}</strong>
      </div>
      <div>
        {/* Optional: show wallet or status */}
        {user.balance !== undefined && (
          <span style={{ fontWeight: "bold" }}>${user.balance}</span>
        )}
      </div>
    </div>
  );
}