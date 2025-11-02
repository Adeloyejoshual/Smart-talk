// src/components/Chat/ForwardPage.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export default function ForwardPage() {
  const { messageId } = useParams();
  const navigate = useNavigate();
  const [messageData, setMessageData] = useState(null);
  const [users, setUsers] = useState([]);

  // 🧩 Load all users
  useEffect(() => {
    const fetchUsers = async () => {
      const querySnapshot = await getDocs(collection(db, "users"));
      const userList = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== auth.currentUser?.uid) {
          userList.push({ id: doc.id, ...doc.data() });
        }
      });
      setUsers(userList);
    };
    fetchUsers();
  }, []);

  // 🧩 Load forwarded message details (optional)
  useEffect(() => {
    // You could fetch from Firestore if you want full content
    setMessageData({
      id: messageId,
      text: "Sample forwarded message",
      type: "text",
    });
  }, [messageId]);

  const handleForward = async (recipientId) => {
    if (!messageData) return;

    const chatId =
      [auth.currentUser?.uid, recipientId].sort().join("_"); // shared chat room

    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: auth.currentUser?.uid,
      text: messageData.text,
      type: messageData.type,
      isForwarded: true,
      createdAt: serverTimestamp(),
    });

    navigate(`/chat/${chatId}`);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-center px-4 py-3 bg-sky-700 text-white shadow-md">
        <button onClick={() => navigate(-1)} className="mr-3">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-lg font-semibold">Forward Message</h2>
      </div>

      {/* Forward Preview */}
      {messageData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="m-4 p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {messageData.text}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">Forwarding...</span>
        </motion.div>
      )}

      {/* Users List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          Send to:
        </h3>
        <div className="space-y-3">
          {users.map((u) => (
            <motion.button
              whileTap={{ scale: 0.98 }}
              key={u.id}
              onClick={() => handleForward(u.id)}
              className="flex items-center gap-3 w-full bg-white dark:bg-gray-800 rounded-xl p-3 hover:bg-sky-100 dark:hover:bg-sky-900 transition"
            >
              <img
                src={u.photoURL || "/default-avatar.png"}
                alt={u.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {u.name}
                </p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}