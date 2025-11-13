// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ArrowLeft, MoreVertical } from "lucide-react";

export default function ChatHeader({ chatId }) {
  const navigate = useNavigate();
  const [chatUser, setChatUser] = useState(null);

  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (snapshot) => {
      if (snapshot.exists()) setChatUser(snapshot.data());
    });
    return unsub;
  }, [chatId]);

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <img
          src={chatUser?.photoURL || "/avatar.png"}
          alt="avatar"
          className="w-10 h-10 rounded-full object-cover"
        />

        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {chatUser?.name || "Chat"}
          </p>
          <p className="text-xs text-gray-500">
            {chatUser?.isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
        <MoreVertical className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>
    </div>
  );
}