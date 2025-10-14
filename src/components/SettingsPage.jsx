// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot, collection, query, where, orderBy, onSnapshot as onCollection } from "firebase/firestore";
import { handleStripePayment, handleFlutterwavePayment } from "../payments";
import { ThemeContext } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [user, setUser] = useState(null);
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);

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

  const handleThemeChange = () => {
    updateSettings(newTheme, newWallpaper);
    alert("Theme updated!");
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div
      style={{
        padding: "20px",
        background: theme === "dark" ? "#1e1e1e" : "#f5f5f5",
        color: theme === "dark" ? "#fff" : "#000",
        minHeight: "100vh",
      }}
    >
      <h2>Settings</h2>

      {/* 💵 Wallet Section */}
      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          borderRadius: "12px",
          background: theme === "dark" ? "#333" : "#fff",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        }}
      >
        <h3>Wallet</h3>
        <p>Balance: <strong>${balance.toFixed(2)}</strong></p>
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={() => handleStripePayment(10, user.uid)}
            style={{
              marginRight: "10px",
              padding: "10px 15px",
              background: "#635BFF",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Add $10 (Stripe)
          </button>
          <button
            onClick={() => handleFlutterwavePayment(10, user.uid)}
            style={{
              padding: "10px 15px",
              background: "#FF9A00",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Add $10 (Flutterwave)
          </button>
        </div>
      </div>

      {/* 🎨 Theme Settings */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          borderRadius: "12px",
          background: theme === "dark" ? "#333" : "#fff",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        }}
      >
        <h3>Theme & Wallpaper</h3>
        <label>Theme: </label>
        <select value={newTheme} onChange={(e) => setNewTheme(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <br /><br />
        <label>Wallpaper URL: </label>
        <input
          type="text"
          value={newWallpaper}
          onChange={(e) => setNewWallpaper(e.target.value)}
          style={{ width: "100%", marginTop: "5px" }}
        />
        <br /><br />
        <button
          onClick={handleThemeChange}
          style={{
            padding: "10px 15px",
            background: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
          }}
        >
          Save
        </button>
      </div>

      {/* 📜 Transaction History */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          borderRadius: "12px",
          background: theme === "dark" ? "#333" : "#fff",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        }}
      >
        <h3>Transaction History</h3>
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {transactions.map((tx) => (
              <li
                key={tx.id}
                style={{
                  borderBottom: "1px solid #ddd",
                  padding: "10px 0",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
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
    </div>
  );
}