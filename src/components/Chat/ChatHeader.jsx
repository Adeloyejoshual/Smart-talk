import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { ArrowLeft, Video, Phone } from "lucide-react";

export default function ChatHeader({ chatId }) {
  const [chatInfo, setChatInfo] = useState(null);
  const [friend, setFriend] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for chat info
    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
      const chatData = snap.data();
      if (!chatData) return;

      setChatInfo(chatData);

      // Identify the other participant
      const otherId = chatData.participants.find(
        (id) => id !== auth.currentUser.uid
      );

      if (otherId) {
        const unsubUser = onSnapshot(doc(db, "users", otherId), (userSnap) => {
          setFriend(userSnap.data());
        });
        return () => unsubUser();
      }
    });

    return () => unsubChat();
  }, [chatId]);

  const lastSeenTime = friend?.lastSeen
    ? new Date(friend.lastSeen.seconds * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 
      flex items-center justify-between px-3 py-2 shadow-sm z-50">

      {/* Left section */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-white" />
        </button>

        <img
          src={friend?.photoURL || "https://via.placeholder.com/40"}
          alt="profile"
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {friend?.displayName || "User"}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {friend?.online
              ? "Online"
              : friend?.lastSeen
              ? `Last seen at ${lastSeenTime}`
              : ""}
          </p>
        </div>
      </div>

      {/* Right section */}
      <div className="flex space-x-2">
        <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <Video className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <Phone className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </div>
  );
}