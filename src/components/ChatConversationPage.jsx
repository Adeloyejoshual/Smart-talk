import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth, storage } from "../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion } from "framer-motion";

import MessageBubble from "./MessageBubble";
import MessageActionsMenu from "./MessageActionsMenu";
import FullScreenPreview from "./FullScreenPreview";
import HeaderActionsBar from "./HeaderActionsBar";
import TypingIndicator from "./TypingIndicator";
import EmojiPicker from "emoji-picker-react";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fullPreview, setFullPreview] = useState(null);
  const [userData, setUserData] = useState(null);
  const scrollRef = useRef();

  const currentUser = auth.currentUser;

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const partnerId = data.participants.find((id) => id !== currentUser.uid);
        const partnerRef = doc(db, "users", partnerId);
        const partnerSnap = await getDoc(partnerRef);
        setUserData(partnerSnap.data());
      }
    };
    fetchUser();
  }, [chatId, currentUser]);

  // Listen for messages in real-time
  useEffect(() => {
    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
    return () => unsubscribe();
  }, [chatId]);

  // Send message (text or media)
  const sendMessage = async () => {
    if (!message && !selectedMedia) return;

    let mediaURL = null;
    let mediaType = null;

    if (selectedMedia) {
      const fileRef = ref(storage, `chatMedia/${chatId}/${Date.now()}_${selectedMedia.name}`);
      await uploadBytes(fileRef, selectedMedia);
      mediaURL = await getDownloadURL(fileRef);
      mediaType = selectedMedia.type.startsWith("image")
        ? "image"
        : selectedMedia.type.startsWith("video")
        ? "video"
        : "file";
    }

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: message,
      mediaURL,
      mediaType,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
    });

    setMessage("");
    setSelectedMedia(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* 🔝 Header (always pinned) */}
      <div className="sticky top-0 z-50">
        <HeaderActionsBar
          user={userData}
          onVoiceCall={() => console.log("Voice call")}
          onVideoCall={() => console.log("Video call")}
        />
      </div>

      {/* 💬 Scrollable message list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentUser={currentUser}
            onMediaClick={setFullPreview}
          />
        ))}
        <div ref={scrollRef} />
        <TypingIndicator />
      </div>

      {/* 📎 Media preview */}
      {selectedMedia && (
        <div className="flex items-center justify-between bg-gray-200 dark:bg-gray-800 px-3 py-2">
          <span className="text-sm truncate">{selectedMedia.name}</span>
          <button
            className="text-red-500"
            onClick={() => setSelectedMedia(null)}
          >
            ✖
          </button>
        </div>
      )}

      {/* 📝 Input bar pinned bottom */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            className="text-gray-500"
            onClick={() => setEmojiOpen((prev) => !prev)}
          >
            😊
          </button>
          <input
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx"
            onChange={(e) => setSelectedMedia(e.target.files[0])}
            className="hidden"
            id="fileInput"
          />
          <label htmlFor="fileInput" className="cursor-pointer text-gray-500">
            📎
          </label>
          <input
            type="text"
            placeholder="Message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white"
          />
          <button
            onClick={sendMessage}
            className="text-sky-500 font-semibold hover:text-sky-600"
          >
            ➤
          </button>
        </div>

        {/* Emoji Picker */}
        {emojiOpen && (
          <div className="absolute bottom-16 left-3 z-50 bg-white shadow-lg rounded-lg">
            <EmojiPicker
              onEmojiClick={(e) => setMessage((prev) => prev + e.emoji)}
              theme="auto"
              width={300}
              height={400}
            />
          </div>
        )}
      </div>

      {/* 🖼 Full-screen media preview */}
      {fullPreview && (
        <FullScreenPreview media={fullPreview} onClose={() => setFullPreview(null)} />
      )}
    </div>
  );
}