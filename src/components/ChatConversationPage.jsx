// src/components/chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { db, auth, storage } from "../../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FiArrowLeft, FiSend, FiPlusCircle } from "react-icons/fi";
import EmojiPicker from "emoji-picker-react";

import MessageBubble from "./MessageBubble";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionBar from "./ReactionBar";
import FullScreenPreview from "./FullScreenPreview";
import ReplyPreview from "./ReplyPreview";
import HeaderActionsBar from "./HeaderActionsBar";
import TypingIndicator from "./TypingIndicator";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [partner, setPartner] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState("");
  const [longPressMsg, setLongPressMsg] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const chatRef = useRef(null);

  // 🧠 Fetch chat partner info
  useEffect(() => {
    const loadPartner = async () => {
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (chatDoc.exists()) {
        const users = chatDoc.data().users;
        const partnerId = users.find((id) => id !== user.uid);
        const partnerDoc = await getDoc(doc(db, "users", partnerId));
        if (partnerDoc.exists()) {
          const partnerData = partnerDoc.data();
          setPartner({ id: partnerId, ...partnerData });

          // 🟢 Listen to live online status
          const unsub = onSnapshot(doc(db, "users", partnerId), (snap) => {
            const d = snap.data();
            if (!d) return;
            if (d.isOnline) setOnlineStatus("Online");
            else if (d.lastSeen?.seconds) {
              const diff = Math.floor(
                (Date.now() - d.lastSeen.seconds * 1000) / 60000
              );
              setOnlineStatus(
                diff < 1
                  ? "Just now"
                  : diff < 60
                  ? `Last seen ${diff} min ago`
                  : `Last seen ${Math.floor(diff / 60)} hr ago`
              );
            }
          });
          return () => unsub();
        }
      }
    };
    loadPartner();
  }, [chatId, user.uid]);

  // 💬 Listen to messages in real time
  useEffect(() => {
    const msgQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(msgQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setTimeout(() => chatRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    });
    return () => unsub();
  }, [chatId]);

  // ✍️ Handle text input
  const handleInputChange = (e) => {
    setInput(e.target.value);
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 2000);
  };

  // 📎 File upload
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith("image") || file.type.startsWith("video")) {
        setPreview(URL.createObjectURL(file));
      }
    }
  };

  // 🚀 Send message
  const sendMessage = async () => {
    if (!input && !selectedFile) return;
    const msgData = {
      senderId: user.uid,
      type: "text",
      content: input,
      createdAt: serverTimestamp(),
      isEdited: false,
    };

    if (selectedFile) {
      const fileRef = ref(storage, `chatFiles/${chatId}/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(fileRef, selectedFile);
      const url = await getDownloadURL(fileRef);

      if (selectedFile.type.startsWith("image")) msgData.type = "image";
      else if (selectedFile.type.startsWith("video")) msgData.type = "video";
      else if (selectedFile.type.startsWith("audio")) msgData.type = "audio";
      else msgData.type = "file";

      msgData.content = url;
      msgData.fileName = selectedFile.name;
    }

    if (replyingTo) msgData.replyTo = replyingTo.id;

    await addDoc(collection(db, "chats", chatId, "messages"), msgData);

    setInput("");
    setSelectedFile(null);
    setPreview(null);
    setReplyingTo(null);
    setShowEmoji(false);
  };

  // 😍 Add emoji
  const handleEmojiSelect = (emoji) => setInput((prev) => prev + emoji.emoji);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-sky-50 to-sky-100 dark:from-gray-900 dark:to-gray-800">
      {/* 🔹 Header */}
      {longPressMsg ? (
        <HeaderActionsBar
          message={longPressMsg}
          onClose={() => setLongPressMsg(null)}
        />
      ) : (
        <div className="flex items-center p-3 border-b border-sky-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button onClick={() => navigate("/chat")} className="mr-2">
            <FiArrowLeft size={22} />
          </button>
          {partner && (
            <>
              <img
                src={partner.photoURL || "/default-avatar.png"}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="ml-3">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {partner.name}
                </h2>
                <p className="text-xs text-gray-500">{onlineStatus}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* 💬 Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} onClick={() => setLongPressMsg(null)}>
            <MessageBubble
              message={msg}
              isOwn={msg.senderId === user.uid}
              onLongPress={() => setLongPressMsg(msg)}
              onReply={(m) => setReplyingTo(m)}
            />
          </div>
        ))}
        <div ref={chatRef}></div>
      </div>

      {isTyping && <TypingIndicator />}

      {preview && (
        <FullScreenPreview
          preview={preview}
          onCancel={() => {
            setPreview(null);
            setSelectedFile(null);
          }}
        />
      )}

      {replyingTo && (
        <ReplyPreview
          message={messages.find((m) => m.id === replyingTo.id)}
          onCancel={() => setReplyingTo(null)}
        />
      )}

      {/* ✍️ Input area */}
      <div className="flex items-center p-2 border-t border-sky-200 bg-white dark:bg-gray-900">
        <label htmlFor="fileInput">
          <FiPlusCircle className="text-sky-500 dark:text-sky-400 mx-2" size={24} />
        </label>
        <input
          id="fileInput"
          type="file"
          hidden
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Message..."
            className="w-full rounded-full px-4 py-2 border border-sky-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
          />
          {showEmoji && (
            <div className="absolute bottom-12 right-0">
              <EmojiPicker onEmojiClick={handleEmojiSelect} theme="light" />
            </div>
          )}
        </div>
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="mx-2 text-gray-500 dark:text-gray-300"
        >
          😀
        </button>
        <button
          onClick={sendMessage}
          className="bg-sky-500 hover:bg-sky-600 text-white p-2 rounded-full"
        >
          <FiSend size={20} />
        </button>
      </div>
    </div>
  );
}