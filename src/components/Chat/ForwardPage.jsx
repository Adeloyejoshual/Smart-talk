// src/components/Chat/ForwardPage.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { ArrowLeft, Send } from "lucide-react";

export default function ForwardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const messageData = location.state?.messageData;

  const [chats, setChats] = useState([]);
  const [selectedChats, setSelectedChats] = useState([]);
  const [sending, setSending] = useState(false);

  // Fetch user's chat list
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const q = query(
          collection(db, "chats"),
          where("participants", "array-contains", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const chatList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setChats(chatList);
      } catch (err) {
        console.error("Error fetching chats:", err);
      }
    };

    fetchChats();
  }, []);

  const handleSelectChat = (chatId) => {
    setSelectedChats((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  };

  const handleForward = async () => {
    if (!messageData || selectedChats.length === 0) return;
    setSending(true);

    try {
      await Promise.all(
        selectedChats.map(async (chatId) => {
          await addDoc(collection(db, "chats", chatId, "messages"), {
            text: messageData.text || "",
            imageUrl: messageData.imageUrl || null,
            senderId: auth.currentUser.uid,
            forwarded: true,
            originalSender: messageData.senderId,
            timestamp: serverTimestamp(),
          });

          await addDoc(collection(db, "chats", chatId, "recentMessages"), {
            text: messageData.text || "Forwarded message",
            senderId: auth.currentUser.uid,
            timestamp: serverTimestamp(),
          });
        })
      );

      navigate(-1); // go back after sending
    } catch (err) {
      console.error("Error forwarding message:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-lg">Forward Message</h1>
            <p className="text-sm text-gray-500">
              {messageData?.text || "Media message"}
            </p>
          </div>
        </div>
        {selectedChats.length > 0 && (
          <button
            onClick={handleForward}
            disabled={sending}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              sending
                ? "bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            } transition`}
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Send"}
          </button>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => handleSelectChat(chat.id)}
            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${
              selectedChats.includes(chat.id)
                ? "bg-blue-100 dark:bg-blue-800"
                : "hover:bg-gray-200 dark:hover:bg-gray-700"
            } transition`}
          >
            <div>
              <h2 className="font-medium">{chat.chatName || "Unnamed Chat"}</h2>
              <p className="text-sm text-gray-500">
                {chat.lastMessage || "No messages yet"}
              </p>
            </div>
            {selectedChats.includes(chat.id) && (
              <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}