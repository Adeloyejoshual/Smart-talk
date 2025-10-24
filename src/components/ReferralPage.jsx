import React, { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function ReferralPage() {
  const [user, setUser] = useState(null);
  const [referralData, setReferralData] = useState({
    referralCount: 0,
    balance: 0,
  });

  const navigate = useNavigate();

  // ✅ Listen to Auth changes & Firestore in real time
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        const unsubDoc = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setReferralData({
              referralCount: data.referralCount || 0,
              balance: data.balance || 0,
            });
          }
        });
        return () => unsubDoc();
      } else {
        navigate("/"); // redirect to login if not logged in
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  if (!user) return <p style={{ textAlign: "center" }}>Loading...</p>;

  const referralLink = `${window.location.origin}/signup?ref=${user.uid}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    alert("✅ Referral link copied!");
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join SmartTalk and get $5 bonus!",
        text: "Sign up with my link and get a $5 welcome bonus 💰",
        url: referralLink,
      });
    } else {
      alert("Sharing not supported on this device. Copy link instead!");
    }
  };

  return (
    <div
      style={{
        padding: "25px",
        maxWidth: "500px",
        margin: "auto",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
        marginTop: "40px",
      }}
    >
      {/* 🔙 Back Button */}
      <button
        onClick={() => navigate("/settings")}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          marginBottom: "15px",
        }}
      >
        ← Back
      </button>

      <h2 style={{ textAlign: "center", marginBottom: "10px" }}>
        👥 Referral Rewards
      </h2>
      <p style={{ textAlign: "center", color: "#666" }}>
        Earn <strong>$0.50</strong> per friend you invite.  
        They get <strong>$5</strong> when they sign up!
      </p>

      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          background: "#f9f9f9",
          borderRadius: "10px",
          border: "1px solid #ddd",
        }}
      >
        <p>
          <strong>Your Referral Link:</strong>
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <input
            type="text"
            value={referralLink}
            readOnly
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: "#f3f3f3",
              fontSize: "14px",
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              padding: "8px 12px",
              background: "#007BFF",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>
        <button
          onClick={handleShare}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            background: "#28a745",
            color: "#fff",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📤 Share Link
        </button>
      </div>

      <div
        style={{
          marginTop: "25px",
          padding: "15px",
          borderRadius: "10px",
          background: "#fefefe",
          border: "1px solid #eee",
        }}
      >
        <h3>🎁 Your Stats</h3>
        <p>
          <strong>Friends Invited:</strong> {referralData.referralCount}
        </p>
        <p>
          <strong>Total Earnings:</strong> $
          {(referralData.referralCount * 0.5).toFixed(2)}
        </p>
        <p>
          <strong>Wallet Balance:</strong> ${referralData.balance.toFixed(2)}
        </p>
      </div>
    </div>
  );
}