// src/components/ChatPage/AddFriendPopup.jsx
import React, { useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function AddFriendPopup({ user, onClose }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleAddFriend = async () => {
    if (!email) return;
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) {
      setMessage("User not found");
      return;
    }
    const friendDoc = snap.docs[0];
    const friendUid = friendDoc.id;

    if (friendUid === user.uid) {
      setMessage("You cannot add yourself");
      return;
    }

    // Add friendUid to current user's friends array
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { friends: Array.from(new Set([...(user.friends || []), friendUid])) });

    // Optional: add current user to friend's friends array
    const friendRef = doc(db, "users", friendUid);
    await updateDoc(friendRef, { friends: Array.from(new Set([...(friendDoc.data().friends || []), user.uid])) });

    setMessage("Friend added!");
    setEmail("");
  };

  return (
    <div style={{
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
    }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 8, minWidth: 300 }}>
        <h3>Add Friend by Gmail</h3>
        <input
          type="email"
          placeholder="friend@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, margin: "10px 0", borderRadius: 5, border: "1px solid #ccc" }}
        />
        <button onClick={handleAddFriend} style={{ padding: "8px 16px", marginRight: 10 }}>Add</button>
        <button onClick={onClose} style={{ padding: "8px 16px" }}>Cancel</button>
        {message && <p style={{ marginTop: 10 }}>{message}</p>}
      </div>
    </div>
  );
}