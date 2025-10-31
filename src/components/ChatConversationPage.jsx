// --- ChatConversationPage.jsx (Step 1: Firestore logic) ---
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db, storage } from "../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [receiver, setReceiver] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const bottomRef = useRef(null);
  const user = auth.currentUser;

  // --- Listen to messages in real-time ---
  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      scrollToBottom();
    });
    return unsubscribe;
  }, [chatId]);

  // --- Get receiver info ---
  useEffect(() => {
    const getReceiver = async () => {
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (chatDoc.exists()) {
        const users = chatDoc.data().users || [];
        const otherUserId = users.find((id) => id !== user.uid);
        if (otherUserId) {
          const userSnap = await getDoc(doc(db, "users", otherUserId));
          if (userSnap.exists()) setReceiver({ id: otherUserId, ...userSnap.data() });
        }
      }
    };
    getReceiver();
  }, [chatId]);

  // --- Typing indicator ---
  const handleTyping = async (e) => {
    setInput(e.target.value);
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      [`typing.${user.uid}`]: e.target.value.length > 0,
    });
  };

  // --- Listen for typing from the other user ---
  useEffect(() => {
    const chatRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(chatRef, (snap) => {
      const data = snap.data();
      if (data?.typing) {
        const other = Object.keys(data.typing).find((id) => id !== user.uid);
        setTypingUser(data.typing[other] ? other : null);
      }
    });
    return unsub;
  }, [chatId]);

  // --- Send message (text, photo, file, audio) ---
  const sendMessage = async (type = "text", file = null) => {
    if (!input.trim() && !file) return;
    const msgData = {
      senderId: user.uid,
      text: input.trim(),
      type,
      timestamp: serverTimestamp(),
    };

    if (file) {
      const fileRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      msgData.fileUrl = await getDownloadURL(fileRef);
      msgData.fileName = file.name;
    }

    await addDoc(collection(db, "chats", chatId, "messages"), msgData);
    setInput("");
    scrollToBottom();
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header + Chat content + Input will come next */}
      <div className="p-4 text-center text-gray-400">Loading chat...</div>
      <div ref={bottomRef}></div>
    </div>
  );
}