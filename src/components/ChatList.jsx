// src/components/ChatList.jsx
import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

export default function ChatList({ onSelectChat, activeChatId }) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChats(chatList);
    });

    return () => unsub();
  }, []);

  return (
    <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      {chats.map((chat) => (
        <div
          key={chat.id}
          onClick={() => onSelectChat(chat.id)}
          className={`p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition 
            ${chat.id === activeChatId ? "bg-gray-100 dark:bg-gray-800" : ""}`}
        >
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {chat.chatName || "Unnamed Chat"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {chat.lastMessage || "Say hello 👋"}
          </p>
          <p className="text-xs text-gray-400">
            {chat.lastMessageAt?.toDate?.()?.toLocaleString?.() || ""}
          </p>
        </div>
      ))}
    </div>
  );
}