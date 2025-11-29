// src/components/ChatPage/AddFriendPopup.jsx
import React, { useState, useContext } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../../context/ThemeContext";

/**
 * Props:
 * - user: current user object (from UserContext)
 * - onClose: function to close popup
 * - onChatCreated: function(chatObj) called after chat is created/found (optimistic)
 */
export default function AddFriendPopup({ user, onClose, onChatCreated }) {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddFriend = async () => {
    if (!email) return setMessage("Enter a valid email");
    if (!user) return setMessage("You must be signed in");

    setMessage("");
    setLoading(true);

    try {
      // find friend by email
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);

      if (snap.empty) {
        setMessage("User not found");
        setLoading(false);
        return;
      }

      const friendDoc = snap.docs[0];
      const friendUid = friendDoc.id;
      const friendData = friendDoc.data();

      if (friendUid === user.uid) {
        setMessage("You cannot add yourself");
        setLoading(false);
        return;
      }

      // update friends arrays (best-effort; won't block chat creation)
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          friends: Array.from(new Set([...(user.friends || []), friendUid])),
        });
      } catch (e) {
        // don't block creation if friends update fails
        console.warn("Failed updating current user's friends:", e);
      }

      try {
        const friendRef = doc(db, "users", friendUid);
        await updateDoc(friendRef, {
          friends: Array.from(new Set([...(friendData.friends || []), user.uid])),
        });
      } catch (e) {
        console.warn("Failed updating friend's friends:", e);
      }

      // check if chat exists between these participants
      let chatId = null;
      const chatsQuery = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
      const chatsSnap = await getDocs(chatsQuery);

      for (let docSnap of chatsSnap.docs) {
        const data = docSnap.data();
        if (Array.isArray(data.participants) && data.participants.includes(friendUid)) {
          chatId = docSnap.id;
          break;
        }
      }

      // If chat doesn't exist, create it
      if (!chatId) {
        const newChatRef = await addDoc(collection(db, "chats"), {
          participants: [user.uid, friendUid],
          lastMessage: "",
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          pinned: false,
          archived: false,
        });
        chatId = newChatRef.id;
      }

      // Build optimistic chat object to show immediately in UI
      const optimisticChat = {
        id: chatId,
        participants: [user.uid, friendUid],
        name: friendData.name || friendData.email || "Unknown",
        photoURL: friendData.profilePic || null,
        lastMessage: "",
        lastMessageAt: new Date(), // client-side timestamp so it appears immediately
        pinned: false,
        archived: false,
      };

      // Notify parent to add the chat immediately
      try {
        onChatCreated && onChatCreated(optimisticChat);
      } catch (e) {
        console.error("onChatCreated callback error:", e);
      }

      // Navigate to chat conversation
      navigate(`/chat/${chatId}`);
      onClose();
    } catch (err) {
      console.error(err);
      setMessage("Failed to add friend. Try again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
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
          minWidth: 320,
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
            disabled={loading}
            style={{
              padding: "8px 12px",
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Adding..." : "Add"}
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