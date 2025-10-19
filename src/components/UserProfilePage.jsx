// src/components/UserProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

function formatLastSeen(lastSeen, isOnline) {
  if (isOnline) return "Online";
  if (!lastSeen) return "";
  const now = new Date();
  const last = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = Math.floor((now - last) / 1000);
  const mins = Math.floor(diff / 60);
  const hrs = Math.floor(mins / 60);
  if (now.toDateString() === last.toDateString()) {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
    return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === last.toDateString()) return "Yesterday";
  return last.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, "users", userId);
    getDoc(ref).then((snap) => {
      if (snap.exists()) setUser({ id: snap.id, ...snap.data() });
    });
  }, [userId]);

  const startCall = (type) => {
    // navigate to call page with params
    navigate(`/call?chatId=${userId}&type=${type}`);
  };

  const startChatWith = async () => {
    // find or create chat between current user and userId, then navigate
    if (!auth.currentUser) return;
    const me = auth.currentUser.uid;
    // search existing chat where participants contains both
    // simple approach: query chats array-contains me and then find the one that includes userId
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", me));
    const snap = await getDocs(q);
    const found = snap.docs.find((d) => d.data().participants.includes(userId));
    if (found) navigate(`/chat/${found.id}`);
    else {
      const newChatRef = await addDoc(chatsRef, {
        participants: [me, userId],
        name: user?.displayName || "Chat",
        photoURL: user?.photoURL || "",
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
      navigate(`/chat/${newChatRef.id}`);
    }
  };

  if (!user) return <div className="p-6">Loading profile...</div>;

  return (
    <div className={`${isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"} min-h-screen`}>
      <div className="px-4 py-4 flex items-center gap-3 border-b">
        <button onClick={() => navigate(-1)}>←</button>
        <h2 className="text-xl font-semibold m-0">{user.displayName || "Profile"}</h2>
      </div>

      <div className="p-6 flex flex-col items-center">
        <img src={user.photoURL || "/default-avatar.png"} alt="profile" className="w-36 h-36 rounded-full object-cover" />
        <h3 className="mt-4 text-2xl">{user.displayName}</h3>
        <p className="text-gray-400 mt-2">{formatLastSeen(user.lastSeen, user.isOnline)}</p>
        {user.email && <p className="text-sm mt-1">{user.email}</p>}

        <div className="mt-6 flex gap-3">
          <button onClick={startChatWith} className="px-4 py-2 rounded-md bg-blue-600 text-white">💬 Start Chat</button>
          <button onClick={() => navigate(`/media/${userId}`)} className="px-4 py-2 rounded-md border">{`🖼 View Media`}</button>
          <button onClick={() => startCall("voice")} className="px-4 py-2 rounded-md border">📞 Voice Call</button>
          <button onClick={() => startCall("video")} className="px-4 py-2 rounded-md border">🎥 Video Call</button>
        </div>
      </div>
    </div>
  );
}