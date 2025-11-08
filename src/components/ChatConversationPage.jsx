import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../firebaseConfig";
import MessageBubble from "./Chat/MessageBubble";
import FileUploadButton from "./Chat/FileUploadButton";
import { Send } from "lucide-react";

export default function ChatConversationPage({ chatId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);

  // 🔹 Load messages in real time
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔹 Send text message
  const sendMessage = async () => {
    if (!input.trim() || !chatId) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: input.trim(),
      senderId: auth.currentUser.uid,
      type: "text",
      timestamp: serverTimestamp(),
    });

    setInput("");
  };

  // 🔹 Handle file uploads
  const handleFileUpload = async (files) => {
    if (!files || !chatId) return;
    setUploading(true);

    for (const file of files) {
      const fileRef = ref(storage, `chats/${chatId}/${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      // ✅ Detect file type correctly
      let messageType = "file";
      if (file.type.startsWith("image/")) messageType = "image";
      else if (file.type.startsWith("video/")) messageType = "video";

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: auth.currentUser.uid,
        type: messageType,
        fileName: file.name,
        fileUrl: url,
        fileType: file.type,
        timestamp: serverTimestamp(),
      });
    }

    setUploading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 dark:bg-gray-900">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderId === auth.currentUser.uid}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-white dark:bg-gray-800">
        <FileUploadButton onFileSelect={handleFileUpload} />
        <input
          type="text"
          placeholder={uploading ? "Uploading..." : "Type a message"}
          value={input}
          disabled={uploading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || uploading}
          className="p-2 rounded-full bg-blue-500 text-white disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}