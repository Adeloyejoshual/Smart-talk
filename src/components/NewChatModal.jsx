// src/components/NewChatModal.jsx
import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

export default function NewChatModal({ onClose }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);

    const q = query(
      collection(db, "users"),
      where("email", ">=", search),
      where("email", "<=", search + "\uf8ff")
    );
    const snapshot = await getDocs(q);
    const users = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((u) => u.uid !== auth.currentUser?.uid);

    setResults(users);
    setLoading(false);
  };

  const startChat = async (user) => {
    try {
      const participants = [auth.currentUser.uid, user.uid].sort();

      // Check if chat already exists
      const existingChatsQuery = query(
        collection(db, "chats"),
        where("participants", "==", participants)
      );
      const existingSnap = await getDocs(existingChatsQuery);

      if (!existingSnap.empty) {
        alert("Chat already exists!");
        return;
      }

      await addDoc(collection(db, "chats"), {
        participants,
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
        chatName: user.displayName || user.email,
      });

      alert("✅ Chat started successfully!");
      onClose();
    } catch (err) {
      console.error("Error starting chat:", err);
      alert("❌ Failed to start chat");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-96 p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          Start New Chat
        </h2>

        <form onSubmit={handleSearch} className="flex mb-3">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-l-md dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-r-md"
          >
            Search
          </button>
        </form>

        {loading && <p className="text-gray-500">Searching...</p>}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((user) => (
            <div
              key={user.uid}
              onClick={() => startChat(user)}
              className="cursor-pointer p-2 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700"
            >
              <p className="font-medium text-gray-800 dark:text-gray-100">{user.displayName}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          ))}
          {!loading && results.length === 0 && search && (
            <p className="text-gray-500 text-sm">No users found.</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}