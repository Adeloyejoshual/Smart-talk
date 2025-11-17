// src/components/ChatConversationPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

// Sub-components
import Header from "./Chat/Header";
import MessageList from "./Chat/MessageList";
import MessageInput from "./Chat/MessageInput";
import ThreeDotMenu from "./Chat/ThreeDotMenu";
import LongPressToolbar from "./Chat/LongPressToolbar";
import ImagePreview from "./Chat/ImagePreview";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const currentUser = auth.currentUser;

  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loadingChat, setLoadingChat] = useState(true);

  const bottomRef = useRef(null);

  // ------------------------------
  // Load user info
  // ------------------------------
  useEffect(() => {
    async function loadUser() {
      try {
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) return;

        const data = chatSnap.data();
        const otherUser = data.users.find((u) => u !== currentUser.uid);

        const userRef = doc(db, "users", otherUser);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) setChatUser({ uid: otherUser, ...userSnap.data() });
      } catch (e) {
        console.error("Error loading chat user", e);
      }
    }
    loadUser();
  }, [chatId]);

  // ------------------------------
  // Load messages in real-time
  // ------------------------------
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      setLoadingChat(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  // ------------------------------
  // Send message
  // ------------------------------
  const sendMessage = async (text, imageUrl = null) => {
    if (!text && !imageUrl) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: text || "",
      imageUrl: imageUrl || null,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      reactions: {},
      type: imageUrl ? "image" : "text",
    });
  };

  // ------------------------------
  // Long press → open toolbar
  // ------------------------------
  const handleLongPress = (msg) => {
    setSelectedMessage(msg);
    setShowToolbar(true);
  };

  // ------------------------------
  // Close menus on background click
  // ------------------------------
  const closeMenus = () => {
    setShowMenu(false);
    setShowToolbar(false);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0d0d0d",
        position: "relative",
      }}
      onClick={(e) => {
        // Close if click outside menus
        if (e.target.classList.contains("closeable-area")) {
          closeMenus();
        }
      }}
    >
      {/* HEADER */}
      <Header
        chatUser={chatUser}
        onOpenMenu={() => setShowMenu(true)}
      />

      {/* 3 DOT MENU */}
      {showMenu && (
        <ThreeDotMenu
          chatUser={chatUser}
          onClose={() => setShowMenu(false)}
        />
      )}

      {/* LONG-PRESS TOOLBAR */}
      {showToolbar && selectedMessage && (
        <LongPressToolbar
          message={selectedMessage}
          onClose={() => setShowToolbar(false)}
          chatId={chatId}
        />
      )}

      {/* MESSAGES */}
      <div
        className="closeable-area"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px",
        }}
      >
        <MessageList
          messages={messages}
          currentUser={currentUser}
          onLongPress={handleLongPress}
          onImageClick={(img) => setImagePreview(img)}
        />

        <div ref={bottomRef} />
      </div>

      {/* MESSAGE INPUT */}
      <MessageInput
        onSend={sendMessage}
        onPreviewImage={(img) => setImagePreview(img)}
      />

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <ImagePreview
          image={imagePreview}
          onClose={() => setImagePreview(null)}
          onSend={(img) => sendMessage("", img)}
        />
      )}

      {loadingChat && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#fff",
            opacity: 0.7,
          }}
        >
          Loading chat…
        </div>
      )}
    </div>
  );
}