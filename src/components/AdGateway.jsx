// src/components/AdGateway.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const AdContext = createContext();

export const useAd = () => useContext(AdContext);

export default function AdGateway({ children }) {
  const [adVisible, setAdVisible] = useState(false);
  const [adDuration, setAdDuration] = useState(15); // default 15 seconds
  const [timeLeft, setTimeLeft] = useState(0);
  const [onComplete, setOnComplete] = useState(null);

  useEffect(() => {
    let timer;
    if (adVisible && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (adVisible && timeLeft === 0 && onComplete) {
      // Ad finished
      onComplete();
      setAdVisible(false);
    }
    return () => clearTimeout(timer);
  }, [adVisible, timeLeft, onComplete]);

  const showRewarded = (duration = 15, callback) => {
    setAdDuration(duration);
    setTimeLeft(duration);
    setOnComplete(() => callback);
    setAdVisible(true);
  };

  const closeAdEarly = () => {
    if (timeLeft <= 0) {
      setAdVisible(false);
      if (onComplete) onComplete();
    } else {
      alert(`Please watch the ad for ${timeLeft} more seconds to claim reward.`);
    }
  };

  return (
    <AdContext.Provider value={{ showRewarded }}>
      {children}

      {adVisible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            flexDirection: "column",
            color: "#fff",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#111",
              padding: 20,
              borderRadius: 12,
              textAlign: "center",
              width: "90%",
              maxWidth: 400,
            }}
          >
            <h2>Advertisement</h2>
            <p>Watch this ad to claim your reward!</p>
            <div
              style={{
                width: "100%",
                height: 200,
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                borderRadius: 12,
                margin: "20px 0",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: 24,
                fontWeight: "bold",
              }}
            >
              Ad Content
            </div>
            <p>Time left: {timeLeft}s</p>
            <button
              onClick={closeAdEarly}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#34d399",
                color: "#fff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AdContext.Provider>
  );
}