// src/components/RewardedAd.jsx
import React, { useEffect } from "react";

export default function RewardedAd({ adUnitId, onReward, onClose }) {
  const showAd = () => {
    if (window.google && window.google.ads) {
      try {
        const ad = new window.google.ads.Ad(adUnitId);
        ad.on("rewarded", () => onReward && onReward());
        ad.load().then(() => ad.show());
        ad.on("closed", () => onClose && onClose());
      } catch (err) {
        console.error("Failed to show Rewarded Ad:", err);
        onClose && onClose();
      }
    } else {
      console.warn("Google ads SDK not loaded");
      onClose && onClose();
    }
  };

  return (
    <button
      onClick={showAd}
      style={{
        padding: "10px 20px",
        borderRadius: 8,
        border: "none",
        background: "#ffd700",
        color: "#000",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      Watch Ad to Claim Reward
    </button>
  );
}
