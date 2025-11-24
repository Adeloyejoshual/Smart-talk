// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ThemeContext } from "../context/ThemeContext";

// -----------------------------
// UTILITY FUNCTIONS
// -----------------------------
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

// Updated initials logic
const getInitials = (name) => {
  if (!name) return "NA";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase(); // single word → first letter
  return (parts[0][0] + parts[1][0]).toUpperCase(); // first two words → initials
};

const formatLastSeen = (ts) => {
  if (!ts) return "Last seen unavailable";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();

  const options = { hour: "numeric", minute: "numeric", hour12: true };
  const time = d.toLocaleTimeString(undefined, options);

  if (d.toDateString() === now.toDateString()) return `Last seen: Today at ${time}`;
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Last seen: Yesterday at ${time}`;

  const dateOptions =
    d.getFullYear() !== now.getFullYear()
      ? { month: "long", day: "numeric", year: "numeric" }
      : { month: "long", day: "numeric" };

  return `Last seen: ${d.toLocaleDateString(undefined, dateOptions)} at ${time}`;
};

// -----------------------------
// COMPONENT
// -----------------------------
export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const currentUser = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [friend, setFriend] = useState({
    displayName: "",
    email: "",
    about: "",
    photoURL: "",
    lastSeen: null,
    blockedBy: [],
  });

  const [actionLoading, setActionLoading] = useState(false);

  // -----------------------------
  // LOAD FRIEND DATA
  // -----------------------------
  useEffect(() => {
    async function loadFriend() {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setFriend(snap.data());
      setLoading(false);
    }
    loadFriend();
  }, [uid]);

  // -----------------------------
  // ACTIONS
  // -----------------------------
  const toggleBlock = async () => {
    if (!currentUser) return;
    setActionLoading(true);
    try {
      const ref = doc(db, "users", uid);
      const isBlocked = friend.blockedBy?.includes(currentUser.uid);

      await updateDoc(ref, {
        blockedBy: isBlocked
          ? friend.blockedBy.filter((id) => id !== currentUser.uid)
          : [...(friend.blockedBy || []), currentUser.uid],
      });

      setFriend((f) => ({
        ...f,
        blockedBy: isBlocked
          ? f.blockedBy.filter((id) => id !== currentUser.uid)
          : [...(f.blockedBy || []), currentUser.uid],
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to update block status.");
    } finally {
      setActionLoading(false);
    }
  };

  const sendMessage = () => {
    navigate(`/chat/${[currentUser.uid, uid].sort().join("_")}`);
  };

  const reportUser = () => {
    alert(`You reported ${friend.displayName || "this user"}.`);
  };

  if (loading) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${
          isDark ? "bg-black text-white" : "bg-white text-black"
        }`}
      >
        Loading profile…
      </div>
    );
  }

  const isBlocked = friend.blockedBy?.includes(currentUser.uid);

  return (
    <div className={`${isDark ? "bg-black text-white" : "bg-white text-black"} min-h-screen p-4`}>
      {/* BACK */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-2xl font-bold">
          ←
        </button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      {/* PROFILE PICTURE */}
      <div
        className="w-32 h-32 rounded-full mb-4 flex items-center justify-center border border-gray-700 overflow-hidden mx-auto"
        style={{
          backgroundColor: friend.photoURL
            ? "transparent"
            : stringToColor(uid || friend.displayName || "NA"),
        }}
      >
        {friend.photoURL ? (
          <img src={friend.photoURL} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: "3rem" }}>
            {getInitials(friend.displayName)}
          </span>
        )}
      </div>

      {/* NAME / ABOUT / LAST SEEN */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-semibold">{friend.displayName}</h2>
        <p className="text-gray-400 text-sm mt-1">{friend.about || "No bio added."}</p>
        <p className="text-gray-500 text-xs mt-2">{formatLastSeen(friend.lastSeen)}</p>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto mt-4">
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Send Message
        </button>

        <button
          onClick={toggleBlock}
          className={`py-2 rounded-lg font-semibold transition ${
            isBlocked
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
          disabled={actionLoading}
        >
          {isBlocked ? "Unblock User" : "Block User"}
        </button>

        <button
          onClick={reportUser}
          className="bg-gray-600 text-white py-2 rounded-lg font-semibold hover:bg-gray-700 transition"
        >
          Report User
        </button>
      </div>
    </div>
  );
}