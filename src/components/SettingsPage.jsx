// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SettingsPage() {
  const { theme, updateSettings } = useContext(ThemeContext);
  const { showPopup, hidePopup } = usePopup();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";

  const backend = "https://smart-talk-zlxe.onrender.com";

  // ================== Load User + Wallet ==================
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");

      setUser(u);
      setEmail(u.email || "");

      // Load wallet
      loadWallet(u.uid);

      const userRef = doc(db, "users", u.uid);

      // Ensure user doc exists
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          email: u.email || "",
          profilePic: null,
          preferences: { theme: "light" },
          createdAt: serverTimestamp(),
        });
      }

      // Live snapshot for profile
      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  const getToken = async () => auth.currentUser.getIdToken(true);

  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      } else {
        showPopup(data.error || "Failed to load wallet.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to load wallet. Check console.");
    }
  };

  // ================== Daily Reward ==================
  const alreadyClaimed = (() => {
    if (!transactions || transactions.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions.some((t) => {
      if (t.type !== "checkin") return false;
      const txDate = new Date(t.createdAt || t.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === today.getTime();
    });
  })();

  const handleDailyReward = async () => {
    if (!user) return;
    setLoadingReward(true);

    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 0.25 }),
      });
      const data = await res.json();

      if (res.ok) {
        setBalance(data.balance);
        setTransactions((prev) => [data.txn, ...prev]);
        showPopup("🎉 Daily reward claimed!");
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ You already claimed today's reward!");
      } else {
        showPopup(data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ================== Cloudinary Upload ==================
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error("Cloudinary environment not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );
    if (!res.ok) throw new Error("Cloudinary upload failed");

    const data = await res.json();
    return data.secure_url || data.url;
  };

  const onProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));

    try {
      const url = await uploadToCloudinary(file);
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { profilePic: url, updatedAt: serverTimestamp() });
      setProfilePic(url);
      setSelectedFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload profile picture.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: isDark ? "#2b2b2b" : "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          marginBottom: 25,
          position: "relative",
        }}
      >
        {/* Profile Picture */}
        <div
          onClick={() => navigate("/edit-profile")}
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            background: profilePic ? `url(${profilePic}) center/cover` : "#888",
            cursor: "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "#fff",
            fontWeight: "bold",
          }}
          title="Click to edit profile"
        >
          {!profilePic && (name?.[0] || "U")}
        </div>

        {/* User Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{name || "Unnamed User"}</h3>

            {/* Menu */}
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button
                onClick={() => setMenuOpen((s) => !s)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: isDark ? "#fff" : "#222",
                  cursor: "pointer",
                  fontSize: 20,
                }}
              >
                ⋮
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 34,
                    background: isDark ? "#1a1a1a" : "#fff",
                    color: isDark ? "#fff" : "#000",
                    borderRadius: 8,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    zIndex: 60,
                    minWidth: 150,
                  }}
                >
                  <button
                    onClick={() => {
                      navigate("/edit-profile");
                      setMenuOpen(false);
                    }}
                    style={menuItemStyle}
                  >
                    Edit Info
                  </button>
                  <button onClick={handleLogout} style={menuItemStyle}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>

          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555" }}>
            {bio || "No bio yet — click ⋮ → Edit Info to add one."}
          </p>
          <p style={{ margin: "0 0 12px", color: isDark ? "#bbb" : "#777", fontSize: 13 }}>
            {email}
          </p>

          {/* ================= Wallet Panel ================= */}
          <div
            style={{
              padding: 12,
              background: isDark ? "#1f1f1f" : "#eef6ff",
              borderRadius: 12,
              cursor: "pointer",
            }}
            onClick={() => navigate("/wallet")}
          >
            <p style={{ margin: 0 }}>
              Balance:{" "}
              <strong style={{ color: isDark ? "#00e676" : "#007bff" }}>
                ${balance.toFixed(2)}
              </strong>
            </p>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDailyReward();
              }}
              disabled={alreadyClaimed || loadingReward}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "none",
                background: alreadyClaimed ? "#666" : "#ffd700",
                color: "#000",
                fontWeight: "bold",
                cursor: alreadyClaimed ? "not-allowed" : "pointer",
              }}
            >
              {loadingReward
                ? "Processing..."
                : alreadyClaimed
                ? "Already Claimed"
                : "🧩 Daily Reward (+$0.25)"}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for Cloudinary */}
      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onProfileFileChange}
      />
    </div>
  );
}

/* Styles */
const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
};