import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Video, ArrowLeft } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function HeaderActionsBar({ chatUser }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("offline");
  const [lastSeen, setLastSeen] = useState(null);

  // 🔁 Real-time status update
  useEffect(() => {
    if (!chatUser?.uid) return;
    const unsub = onSnapshot(doc(db, "users", chatUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStatus(data.isOnline ? "online" : "offline");
        if (data.lastSeen?.toDate) {
          const d = data.lastSeen.toDate();
          const formatted = `${d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
          })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
          setLastSeen(formatted);
        }
      }
    });
    return () => unsub();
  }, [chatUser?.uid]);

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between shadow-sm">
      {/* ← Back button & profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 dark:text-gray-300 hover:text-blue-500 transition"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-3">
          <img
            src={chatUser?.photoURL || "/default-avatar.png"}
            alt="Avatar"
            className="w-10 h-10 rounded-full object-cover border border-gray-300"
          />
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
              {chatUser?.name || "Unknown"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status === "online"
                ? "Online"
                : lastSeen
                ? `Last seen ${lastSeen}`
                : "Offline"}
            </p>
          </div>
        </div>
      </div>

      {/* 📞 🎥 Icons */}
      <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
        <button className="hover:text-blue-500 transition">
          <Phone size={22} />
        </button>
        <button className="hover:text-blue-500 transition">
          <Video size={22} />
        </button>
      </div>
    </header>
  );
}