// src/components/RewardedAd.jsx
import React, { useEffect } from "react";

// Props:
// adUnitId: AdMob Rewarded ad unit ID
// onReward: callback function to give user coins or rewards
export default function RewardedAd({ adUnitId, onReward }) {
  useEffect(() => {
    // Check if the Google Mobile Ads SDK is available
    if (!window.google || !window.google.ads) return;

    const ad = new window.google.ads.Ad(adUnitId);

    ad.on('rewarded', () => {
      if (onReward) onReward(); // Give reward to user
    });

    ad.load().catch(console.error);

    // Cleanup
    return () => ad.destroy && ad.destroy();
  }, [adUnitId, onReward]);

  const showAd = () => {
    if (window.google && window.google.ads) {
      try {
        const ad = new window.google.ads.Ad(adUnitId);
        ad.show();
      } catch (e) {
        console.error("Failed to show Rewarded Ad:", e);
      }
    }
  };

  return (
    <button
      onClick={showAd}
      style={{
        padding: "10px 20px",
        background: "#4f46e5",
        color: "#fff",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
      }}
    >
      Watch Ad & Get Reward
    </button>
  );
}
