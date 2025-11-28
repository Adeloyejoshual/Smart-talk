import React, { useState } from "react";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AddFriendPopup({ user, onClose }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

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

    // Add current user to friend's friends array
    const friendRef = doc(db, "users", friendUid);
    await updateDoc(friendRef, { friends: Array.from(new Set([...(friendDoc.data().friends || []), user.uid])) });

    // Check if chat exists
    const chatQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );
    const chatSnap = await getDocs(chatQuery);
    let chatId = null;

    for (let docSnap of chatSnap.docs) {
      const data = docSnap.data();
      if (data.participants.includes(friendUid)) {
        chatId = docSnap.id;
        break;
      }
    }

    // Create chat if not exist
    if (!chatId) {
      const newChat = await addDoc(collection(db, "chats"), {
        participants: [user.uid, friendUid],
        lastMessage: "",
        lastMessageAt: null,
        createdAt: new Date(),
      });
      chatId = newChat.id;
    }

    // Navigate to chat conversation
    navigate(`/chat/${chatId}`);
    onClose();
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 8, minWidth: 300 }}>
        <h3>Add Friend</h3>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Friend's Gmail" style={{ width: "100%", padding: 8, marginBottom: 10 }} />
        <button onClick={handleAddFriend} style={{ padding: "8px 12px", marginRight: 10 }}>Add</button>
        <button onClick={onClose} style={{ padding: "8px 12px" }}>Cancel</button>
        {message && <p style={{ marginTop: 10, color: "red" }}>{message}</p>}
      </div>
    </div>
  );
}