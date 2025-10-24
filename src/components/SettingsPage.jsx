// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  onSnapshot as onCollection,
  serverTimestamp,
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false); // 🆕
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ✅ Load user, wallet, and apply $5 new user bonus
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        setUser(userAuth);
        const userRef = doc(db, "users", userAuth.uid);
        const userSnap = await getDoc(userRef);

        // 💰 Give $5 bonus to new users
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            balance: 5.0,
            createdAt: serverTimestamp(),
            lastCheckin: null, // 🆕
          });
          alert("🎁 Welcome! You’ve received a $5 new user bonus!");
        }

        // 💵 Listen for balance updates
        const unsubBalance = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBalance(data.balance || 0);
            checkLastCheckin(data.lastCheckin); // 🆕
          }
        });

        // 🧾 Listen for transactions
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

  // 🆕 Check if user has already checked in today
  const checkLastCheckin = (lastCheckin) => {
    if (!lastCheckin) return setCheckedInToday(false);
    const lastDate = new Date(lastCheckin.seconds * 1000);
    const today = new Date();
    if (
      lastDate.getDate() === today.getDate() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getFullYear() === today.getFullYear()
    ) {
      setCheckedInToday(true);
    } else {
      setCheckedInToday(false);
    }
  };

  // 🆕 Handle Daily Check-in Reward
  const handleDailyCheckin = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      const lastCheckin = data.lastCheckin
        ? new Date(data.lastCheckin.seconds * 1000)
        : null;
      const today = new Date();

      if (
        lastCheckin &&
        lastCheckin.getDate() === today.getDate() &&
        lastCheckin.getMonth() === today.getMonth() &&
        lastCheckin.getFullYear() === today.getFullYear()
      ) {
        alert("✅ You already checked in today!");
        return;
      }

      const newBalance = (data.balance || 0) + 0.25;
      await updateDoc(userRef, {
        balance: newBalance,
        lastCheckin: serverTimestamp(),
      });

      setCheckedInToday(true);
      alert("🎉 You earned +$0.25 for your daily check-in!");
    }
  };

  // 🎨 Live wallpaper preview
  useEffect(() => {
    setPreviewWallpaper(newWallpaper);
  }, [newWallpaper]);

  // 💾 Save theme & wallpaper
  const handleThemeChange = () => {
    updateSettings(newTheme, newWallpaper);
    alert("✅ Theme and wallpaper updated!");
  };

  // 📸 Handle wallpaper click
  const handleWallpaperClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setNewWallpaper(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // 🚪 Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      alert("Logout failed: " + error.message);
    }
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
        position: "relative",
      }}
    >
      {/* 🔙 Back */}
      <button
        onClick={() => navigate("/chat")}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          cursor: "pointer",
          padding: "8px",
          borderRadius: "50%",
          border: "none",
          background: isDark ? "#555" : "#e0e0e0",
        }}
      >
        ⬅
      </button>

      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>⚙️ Settings</h2>

      {/* 💰 Wallet */}
      <div style={sectionStyle(isDark)}>
        <h3>Wallet</h3>
        <p>
          Balance:{" "}
          <strong style={{ color: isDark ? "#00e676" : "#007BFF" }}>
            ${balance.toFixed(2)}
          </strong>
        </p>

        {/* 🆕 Daily Check-in */}
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={handleDailyCheckin}
            disabled={checkedInToday}
            style={{
              ...btnStyle(checkedInToday ? "#666" : "#4CAF50"),
              opacity: checkedInToday ? 0.7 : 1,
            }}
          >
            {checkedInToday ? "✅ Checked-in Today" : "🧩 Daily Check-in (+$0.25)"}
          </button>
        </div>

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
          <button
            onClick={() => alert("💸 Withdraw feature coming soon!")}
            style={btnStyle("#555")}
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* 🎨 Theme */}
      <div style={sectionStyle(isDark)}>
        <h3>Theme & Wallpaper</h3>
        <select
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          style={selectStyle(isDark)}
        >
          <option value="light">🌞 Light</option>
          <option value="dark">🌙 Dark</option>
        </select>

        <div
          onClick={handleWallpaperClick}
          style={{
            ...previewBox,
            backgroundImage: previewWallpaper ? `url(${previewWallpaper})` : "none",
          }}
        >
          <p>🌈 Live Preview</p>
        </div>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button onClick={handleThemeChange} style={btnStyle("#007BFF")}>
          💾 Save
        </button>
      </div>

      {/* 📜 Transactions */}
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

// 💅 Styles
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