// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  onSnapshot as onCollection,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [previewWallpaper, setPreviewWallpaper] = useState(wallpaper);
  const navigate = useNavigate();

  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/"); // redirect to login
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
  };

  // ✅ Load current user and wallet in real-time
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userAuth) => {
      if (userAuth) {
        setUser(userAuth);
        const userRef = doc(db, "users", userAuth.uid);
        const unsubBalance = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setBalance(docSnap.data().balance || 0);
          }
        });

        const txRef = collection(db, "transactions");
        const txQuery = query(
          txRef,
          where("uid", "==", userAuth.uid),
          orderBy("createdAt", "desc")
        );

        const unsubTx = onCollection(txQuery, (snapshot) => {
          setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return () => {
          unsubBalance();
          unsubTx();
        };
      }
    });

    return () => unsubscribe();
  }, []);

  // 🖼️ Update live wallpaper preview
  useEffect(() => {
    setPreviewWallpaper(newWallpaper);
  }, [newWallpaper]);

  // 💾 Save theme & wallpaper
  const handleThemeChange = () => {
    updateSettings(newTheme, newWallpaper);
    alert("✅ Theme and wallpaper updated!");
  };

  if (!user) return <p>Loading user...</p>;

  const isDark = newTheme === "dark";

  return (
    <div
      style={{
        padding: "20px",
        background: isDark ? "#1e1e1e" : "#f5f5f5",
        color: isDark ? "#fff" : "#000",
        minHeight: "100vh",
        transition: "all 0.3s ease",
      }}
    >
      <h2>⚙️ Settings</h2>

      {/* 💵 Wallet Section */}
      <div style={sectionStyle(isDark)}>
        <h3>Wallet</h3>
        <p>
          Balance:{" "}
          <strong style={{ color: isDark ? "#00e676" : "#007BFF" }}>
            ${balance.toFixed(2)}
          </strong>
        </p>
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={() => handleStripePayment(10, user.uid)}
            style={btnStyle("#635BFF")}
          >
            Add $10 (Stripe)
          </button>
          <button
            onClick={() => handleFlutterwavePayment(10, user.uid)}
            style={btnStyle("#FF9A00")}
          >
            Add $10 (Flutterwave)
          </button>
        </div>
      </div>

      {/* 🎨 Theme Settings */}
      <div style={sectionStyle(isDark)}>
        <h3>Theme & Wallpaper</h3>

        <label>Theme:</label>
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <br />
        <br />
        <label>Wallpaper URL:</label>
        <input
          type="text"
          value={newWallpaper}
          onChange={(e) => setNewWallpaper(e.target.value)}
          placeholder="Paste image link"
          style={inputStyle(isDark)}
        />

        <div
          style={{
            ...previewBox,
            backgroundColor: isDark ? "#000" : "#fff",
            color: isDark ? "#fff" : "#000",
            backgroundImage: previewWallpaper
              ? `url(${previewWallpaper})`
              : "none",
          }}
        >
          <p>🌈 Live Preview</p>
          <small>(Your theme and wallpaper will look like this)</small>
        </div>

        <button onClick={handleThemeChange} style={btnStyle("#007BFF")}>
          💾 Save
        </button>
      </div>

      {/* 📜 Transaction History */}
      <div style={sectionStyle(isDark)}>
        <h3>Transaction History</h3>
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {transactions.map((tx) => (
              <li key={tx.id} style={txItemStyle(isDark)}>
                <div>
                  <strong>{tx.gateway}</strong> — ${tx.amount.toFixed(2)}
                  <br />
                  <small>{tx.status}</small>
                </div>
                <div>
                  <small>
                    {tx.createdAt
                      ? new Date(tx.createdAt.seconds * 1000).toLocaleString()
                      : ""}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 🚪 Logout */}
      <div style={{ marginTop: "30px", textAlign: "center" }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

// 💅 Shared Styles
const sectionStyle = (isDark) => ({
  marginTop: "30px",
  padding: "20px",
  borderRadius: "12px",
  background: isDark ? "#333" : "#fff",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
});

const btnStyle = (bg) => ({
  marginRight: "10px",
  padding: "10px 15px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
});

const selectStyle = (isDark) => ({
  padding: "8px",
  borderRadius: "6px",
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
  border: "1px solid #666",
  width: "100%",
});

const inputStyle = (isDark) => ({
  width: "100%",
  marginTop: "5px",
  padding: "8px",
  borderRadius: "6px",
  border: "1px solid #555",
  background: isDark ? "#222" : "#fafafa",
  color: isDark ? "#fff" : "#000",
});

const previewBox = {
  width: "100%",
  height: "160px",
  borderRadius: "10px",
  border: "2px solid #555",
  margin: "15px 0 20px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

const txItemStyle = (isDark) => ({
  borderBottom: isDark ? "1px solid #555" : "1px solid #ddd",
  padding: "10px 0",
  display: "flex",
  justifyContent: "space-between",
});