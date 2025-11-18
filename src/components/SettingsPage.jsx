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
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import getCroppedImg from "../utils/cropImage"; // helper

export default function SettingsPage() {
  const { theme, wallpaper, updateSettings } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [registrationName, setRegistrationName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [walletHistory, setWalletHistory] = useState([]); // ✅ Mongo wallet history
  const [newTheme, setNewTheme] = useState(theme);
  const [newWallpaper, setNewWallpaper] = useState(wallpaper);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [language, setLanguage] = useState("English");
  const [fontSize, setFontSize] = useState("Medium");
  const [layout, setLayout] = useState("Default");
  const [notifications, setNotifications] = useState({ push: true, email: true, sound: false });

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const profileInputRef = useRef(null);

  // ================= Load User & Preferences =================
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (!userAuth) return;

      setUser(userAuth);
      setRegistrationName(userAuth.displayName || "");

      const userRef = doc(db, "users", userAuth.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: userAuth.email,
          balance: 5.0,
          createdAt: serverTimestamp(),
          lastCheckin: null,
          profilePic: null,
          displayName: "",
          preferences: { language: "English", fontSize: "Medium", layout: "Default", theme: "light", wallpaper: null },
        });
        alert("🎁 Welcome! You’ve received a $5 new user bonus!");
      } else {
        const data = userSnap.data();
        setDisplayName(data.displayName || "");
        setProfilePic(data.profilePic || null);
        if (data.preferences) {
          setLanguage(data.preferences.language || "English");
          setFontSize(data.preferences.fontSize || "Medium");
          setLayout(data.preferences.layout || "Default");
          setNewTheme(data.preferences.theme || "light");
          setNewWallpaper(data.preferences.wallpaper || wallpaper);
        }
      }

      // ================= Wallet updates =================
      const unsubBalance = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBalance(data.balance || 0);
          checkLastCheckin(data.lastCheckin);
        }
      });

      // Transactions (Firestore)
      const txRef = collection(db, "transactions");
      const txQuery = query(txRef, where("uid", "==", userAuth.uid), orderBy("createdAt", "desc"));
      const unsubTx = onSnapshot(txQuery, (snapshot) => setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))));

      // ✅ Fetch Wallet History from MongoDB
      fetch(`${process.env.REACT_APP_BACKEND_URL || ""}/api/wallet/${userAuth.uid}`)
        .then((res) => res.json())
        .then((data) => setWalletHistory(data))
        .catch((err) => console.error("Failed to fetch wallet history:", err));

      return () => { unsubBalance(); unsubTx(); };
    });

    return () => unsubscribe();
  }, []);

  // ================= Daily check-in =================
  const checkLastCheckin = (lastCheckin) => {
    if (!lastCheckin) return setCheckedInToday(false);
    const lastDate = new Date(lastCheckin.seconds * 1000);
    const today = new Date();
    setCheckedInToday(
      lastDate.getDate() === today.getDate() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getFullYear() === today.getFullYear()
    );
  };

  const handleDailyCheckin = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const lastCheckin = data.lastCheckin ? new Date(data.lastCheckin.seconds * 1000) : null;
      const today = new Date();
      if (lastCheckin && lastCheckin.getDate() === today.getDate() &&
          lastCheckin.getMonth() === today.getMonth() &&
          lastCheckin.getFullYear() === today.getFullYear()) {
        alert("✅ You already checked in today!");
        return;
      }
      const newBalance = (data.balance || 0) + 0.25;
      await updateDoc(userRef, { balance: newBalance, lastCheckin: serverTimestamp() });
      setCheckedInToday(true);
      alert("🎉 You earned +$0.25 for your daily check-in!");
    }
  };

  // ================= Preferences =================
  const handleSavePreferences = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { preferences: { language, fontSize, layout, theme: newTheme, wallpaper: newWallpaper } });
    updateSettings(newTheme, newWallpaper);
    alert("✅ Preferences saved successfully!");
  };

  // --- Profile Section (without cropping) ---
<Section title="Profile" isDark={isDark}>
  <div style={{ textAlign: "center" }}>
    {/* Profile Picture */}
    <div
      onClick={handleProfileClick}
      style={{
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        margin: "0 auto 10px",
        background: profilePic ? `url(${profilePic})` : "#888",
        backgroundSize: "cover",
        backgroundPosition: "center",
        cursor: "pointer",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "36px",
        color: "#fff",
        fontWeight: "bold"
      }}
    >
      {!profilePic && getInitials(displayName)}
    </div>

    <input
      type="file"
      accept="image/*"
      ref={profileInputRef}
      style={{ display: "none" }}
      onChange={(e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (event) => setProfilePic(event.target.result);
        reader.readAsDataURL(file);
      }}
    />

    {/* Profile Info */}
    <label>Full Name:</label>
    <input
      type="text"
      value={displayName}
      onChange={(e) => setDisplayName(e.target.value)}
      style={selectStyle(isDark)}
    />
    <p><strong>Registration Name:</strong> {registrationName || "N/A"}</p>
    <p><strong>Email:</strong> {user.email}</p>
    <p><strong>UID:</strong> {user.uid}</p>

    {/* Save Buttons */}
    <div style={{ marginTop: "10px" }}>
      <button
        onClick={async () => {
          if (!user) return;
          const userRef = doc(db, "users", user.uid);

          // Upload profile picture if selected
          if (selectedFile) {
            try {
              const formData = new FormData();
              formData.append("file", selectedFile);
              formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_PRESET);
              const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD}/image/upload`, {
                method: "POST",
                body: formData
              });
              const data = await res.json();
              const url = data.secure_url;

              await updateDoc(userRef, { profilePic: url });
              setProfilePic(url);
              setSelectedFile(null);
              alert("✅ Profile picture uploaded successfully!");
            } catch (err) {
              console.error(err);
              alert("❌ Failed to upload profile picture");
            }
          }

          // Update display name
          await updateDoc(userRef, { displayName });
          alert("✅ Profile updated successfully!");
        }}
        style={btnStyle("#007bff")}
      >
        💾 Save Profile
      </button>
    </div>
  </div>
</Section>

        {/* Cropper Modal */}
        {selectedFile && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
            <div style={{ position: "relative", width: 300, height: 300, background: "#333", padding: 10, borderRadius: 12 }}>
              <Cropper
                image={profilePic}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
              />
              <button onClick={handleSaveProfilePicture} style={{ ...btnStyle("#007bff"), marginTop: 10 }}>Save</button>
              <button onClick={() => setSelectedFile(null)} style={{ ...btnStyle("#d32f2f"), marginTop: 10 }}>Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* === Wallet Section === */}
      <Section title="Wallet" isDark={isDark}>
        <p><strong>Balance:</strong> ${balance.toFixed(2)}</p>
        <button onClick={handleDailyCheckin} style={btnStyle("#28a745")} disabled={checkedInToday}>
          {checkedInToday ? "Checked-in ✅" : "Daily Check-in 💰"}
        </button>

        {/* Wallet History */}
        <div style={{ marginTop: "15px", maxHeight: "200px", overflowY: "auto", border: `1px solid ${isDark ? "#444" : "#ccc"}`, padding: "10px", borderRadius: "8px" }}>
          {walletHistory.length === 0 ? (
            <p>No wallet history yet.</p>
          ) : (
            walletHistory.map((txn) => (
              <div key={txn._id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span>{txn.description || txn.type}</span>
                <span style={{ color: txn.type === "credit" ? "#28a745" : "#d32f2f" }}>
                  {txn.type === "credit" ? "+" : "-"}${txn.amount.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button onClick={handleLogout} style={btnStyle("#d32f2f")}>🚪 Logout</button>
      </div>
    </div>
  );
}

/* === Section Wrapper === */
function Section({ title, children, isDark }) {
  return (
    <div style={{ background: isDark ? "#2b2b2b" : "#fff", padding: "20px", borderRadius: "12px", marginTop: "25px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* === Styles === */
const btnStyle = (bg) => ({ marginRight: "8px", padding: "10px 15px", background: bg, color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" });
const selectStyle = (isDark) => ({ width: "100%", padding: "8px", marginBottom: "10px", borderRadius: "6px", background: isDark ? "#222" : "#fafafa", color: isDark ? "#fff" : "#000", border: "1px solid #666" });