// src/components/InterstitialAd.jsx
import React, { useEffect } from "react";

// Props:
// adUnitId: AdMob Interstitial ad unit ID
export default function InterstitialAd({ adUnitId }) {
  useEffect(() => {
    if (!window.google || !window.google.ads) return;

    const ad = new window.google.ads.Ad(adUnitId);
    ad.load().catch(console.error);

    return () => ad.destroy && ad.destroy();
  }, [adUnitId]);

  const showAd = () => {
    if (window.google && window.google.ads) {
      try {
        const ad = new window.google.ads.Ad(adUnitId);
        ad.show();
      } catch (e) {
        console.error("Failed to show Interstitial Ad:", e);
      }
    }
  };

  return (
    <button
      onClick={showAd}
      style={{
        padding: "10px 20px",
        background: "#f59e0b",
        color: "#fff",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
      }}
    >
      Show Interstitial Ad
    </button>
  );
}
