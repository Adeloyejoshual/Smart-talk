// src/components/ChatConversationPage.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  onSnapshot as onDoc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { Send, Paperclip, File, Music, Loader2, ChevronLeft } from "lucide-react";

export default function ChatConversationPage({ chatId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef();

  // 🔥 Load messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      scrollToBottom();
    });
    return () => unsub();
  }, [chatId]);

  // 🧩 Fetch other user's info and listen for online/offline changes
  useEffect(() => {
    const getChatUser = async () => {
      if (!chatId || !auth.currentUser) return;

      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const otherUserId = chatData.participants.find(
          (id) => id !== auth.currentUser.uid
        );
        if (otherUserId) {
          const userRef = doc(db, "users", otherUserId);
          onDoc(userRef, (snap) => {
            if (snap.exists()) setChatUser({ id: otherUserId, ...snap.data() });
          });
        }
      }
    };
    getChatUser();
  }, [chatId]);

  // ☁️ Upload to Cloudinary
  const uploadToCloudinary = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded * 100) / e.total);
          setUploadProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } else reject(new Error("Cloudinary upload failed"));
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      xhr.send(formData);
    });
  };

  // 🖼️ File upload handler
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedUrl = await uploadToCloudinary(file);
      const type = detectFileType(file);
      setPreview(null);
      await sendMessage(uploadedUrl, type);
    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert("Upload failed - check Cloudinary config or network.");
    } finally {
      setUploading(false);
    }
  };

  const detectFileType = (file) => {
    const type = file.type;
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type === "application/pdf") return "pdf";
    if (type.startsWith("audio/")) return "audio";
    return "file";
  };

  const sendMessage = async (content, type = "text") => {
    if (!chatId || !auth.currentUser) return;
    if (type === "text" && !content.trim()) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      text: type === "text" ? content : "",
      mediaUrl: type !== "text" ? content : "",
      mediaType: type,
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
  };

  const handleSend = () => sendMessage(newMessage, "text");

  const renderMessageContent = (msg) => {
    if (msg.mediaUrl) {
      switch (msg.mediaType) {
        case "image":
          return <img src={msg.mediaUrl} alt="sent" className="rounded-lg max-h-60" />;
        case "video":
          return <video controls src={msg.mediaUrl} className="rounded-lg max-h-60" />;
        case "pdf":
          return (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-red-500 underline">
              <File className="mr-2 text-red-500" /> View PDF
            </a>
          );
        case "audio":
          return (
            <div className="flex items-center space-x-2">
              <Music className="text-blue-500" />
              <audio controls src={msg.mediaUrl} className="w-40" />
            </div>
          );
        default:
          return (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-500 underline">
              <File className="mr-2 text-blue-500" /> Download File
            </a>
          );
      }
    }
    return <p className="text-gray-800 dark:text-gray-100">{msg.text}</p>;
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    return `last seen ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* 🔝 Chat header */}
      <div className="flex items-center p-3 border-b bg-white dark:bg-gray-800">
        {onBack && (
          <button onClick={onBack} className="mr-3">
            <ChevronLeft size={22} className="text-gray-600 dark:text-gray-200" />
          </button>
        )}
        {chatUser && (
          <>
            <div className="relative">
              <img
                src={chatUser.photoURL || "https://via.placeholder.com/40"}
                alt={chatUser.displayName}
                className="w-10 h-10 rounded-full object-cover border border-gray-300"
              />
              {chatUser.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></span>
              )}
            </div>
            <div className="ml-3">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{chatUser.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {chatUser.isOnline ? "Online" : formatLastSeen(chatUser.lastSeen)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 💬 Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === auth.currentUser?.uid ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[75%] p-2 rounded-2xl bg-white dark:bg-gray-800 shadow">
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        {preview && (
          <div className="flex justify-end mt-2">
            <div className="p-2 bg-blue-50 dark:bg-gray-800 rounded-xl">
              <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-lg" />
              {uploading && (
                <p className="text-xs text-blue-500 flex items-center mt-1">
                  <Loader2 className="animate-spin mr-1" size={14} />
                  Uploading {uploadProgress}%...
                </p>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* 📝 Input */}
      <div className="flex items-center p-3 border-t bg-white dark:bg-gray-800">
        <label className="cursor-pointer mr-3">
          <Paperclip size={22} className="text-gray-500" />
          <input type="file" hidden onChange={handleFileSelect} />
        </label>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-700 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="ml-3 p-2 bg-blue-500 hover:bg-blue-600 rounded-full text-white disabled:bg-gray-400"
          disabled={!newMessage.trim()}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}