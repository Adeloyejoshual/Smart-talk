// src/components/Chat/BlockedBanner.jsx
import React from "react";

export default function BlockedBanner({ youBlocked, blockedYou }) {
  if (!youBlocked && !blockedYou) return null;

  return (
    <div className="blocked-banner">
      {youBlocked && (
        <p>You have blocked this user. You cannot send messages.</p>
      )}

      {blockedYou && (
        <p>This user has blocked you. Messages will not be delivered.</p>
      )}
    </div>
  );
}
