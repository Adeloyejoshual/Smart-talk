// src/components/ChatPage/AddFriendPopup.jsx
import React, { useState, useContext } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";

export default function AddFriendPopup({ user, onClose }) {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleAddFriend = async () => {
    if (!email.trim()) return setMessage("Enter a valid email");

    try {
      // Find friend by email
      const q = query(collection(db, "users"), where("email", "==", email.trim()));
      const snap = await getDocs(q);

      if (snap.empty) return setMessage("User not found");

      const friendDoc = snap.docs[0];
      const friendUid = friendDoc.id;

      if (friendUid === user.uid) return setMessage("You cannot add yourself");

      // Update friends list for both users
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        friends: Array.from(new Set([...(user.friends || []), friendUid]))
      });

      const friendRef = doc(db, "users", friendUid);
      await updateDoc(friendRef, {
        friends: Array.from(new Set([...(friendDoc.data().friends || []), user.uid]))
      });

      // Check if chat already exists
      const chatQuery = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
      const chatSnap = await getDocs(chatQuery);

      let chatId = null;
      for (let docSnap of chatSnap.docs) {
        if (docSnap.data().participants.includes(friendUid)) {
          chatId = docSnap.id;
          break;
        }
      }

      // Create new chat if it doesn't exist
      if (!chatId) {
        const newChat = await addDoc(collection(db, "chats"), {
          participants: [user.uid, friendUid],
          lastMessage: "",
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        chatId = newChat.id;
      }

      // Navigate to chat conversation
      navigate(`/chat/${chatId}`);
      onClose();

    } catch (err) {
      console.error("Add friend error:", err);
      setMessage("Failed to add friend. Try again.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: isDark ? "#2c2c2c" : "#fff",
          color: isDark ? "#fff" : "#000",
          padding: 20,
          borderRadius: 8,
          minWidth: 300,
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Add Friend</h3>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Friend's email"
          style={{
            width: "100%",
            padding: 8,
            marginBottom: 10,
            borderRadius: 5,
            border: "1px solid #ccc",
            background: isDark ? "#444" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={handleAddFriend}
            style={{
              padding: "8px 12px",
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Add
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              background: isDark ? "#555" : "#eee",
              color: isDark ? "#fff" : "#000",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>

        {message && <p style={{ marginTop: 10, color: "red" }}>{message}</p>}
      </div>
    </div>
  );
}