import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  increment,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ForwardPage() {
  const [contacts, setContacts] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { messageId, messageData } = location.state || {};

  useEffect(() => {
    // Load contacts (or chats) from Firestore
    // You can fetch all chats or user friends list here
    // Example placeholder contacts
    setContacts([
      { id: "user1", name: "Ade" },
      { id: "user2", name: "Kude" },
      { id: "user3", name: "Bayo" },
    ]);
  }, []);

  // 🔁 Handle forward action
  const handleForward = async (receiverId) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1️⃣ Create a new message in receiver's chat
      const chatRef = collection(db, "chats", receiverId, "messages");
      await addDoc(chatRef, {
        text: messageData.text || "",
        imageUrl: messageData.imageUrl || null,
        senderId: user.uid,
        receiverId,
        timestamp: serverTimestamp(),
        forwarded: true,
        forwardCount: (messageData.forwardCount || 0) + 1,
      });

      // 2️⃣ Increment forward count in original message
      if (messageId && messageData.chatId) {
        const originalMsgRef = doc(
          db,
          "chats",
          messageData.chatId,
          "messages",
          messageId
        );
        await updateDoc(originalMsgRef, {
          forwardCount: increment(1),
        });
      }

      // ✅ Navigate back to chat
      navigate(`/chat/${receiverId}`);
    } catch (error) {
      console.error("Error forwarding message:", error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Forward message</h2>
      <p className="text-sm text-gray-500">
        Select a contact to forward this message to:
      </p>

      {contacts.map((contact) => (
        <Button
          key={contact.id}
          onClick={() => handleForward(contact.id)}
          className="w-full justify-start"
        >
          {contact.name}
        </Button>
      ))}
    </div>
  );
}