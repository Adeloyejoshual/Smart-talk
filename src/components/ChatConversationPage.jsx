// src/components/ChatConversationPage.jsx
import React, { useState, useEffect, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import MessageBubble from "./Chat/MessageBubble";
import FileUploadButton from "./Chat/FileUploadButton";
import Spinner from "./Chat/Spinner";
import { uploadFileWithProgress } from "../awsS3";
import { ThemeContext } from "../context/ThemeContext";
import { X } from "lucide-react";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const bottomRef = useRef(null);

  // ✅ Load chat messages in real time
  useEffect(() => {
    if (!chatId) return;
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [chatId]);

  // ✅ Handle selecting files (preview)
  const handleSelectFiles = (files) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...fileArray]);
  };

  // ✅ Remove preview before sending
  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ✅ Handle sending messages + files
  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = newMsg.trim();

    // If no message and no file, do nothing
    if (!trimmed && selectedFiles.length === 0) return;

    try {
      // Upload all selected files
      if (selectedFiles.length > 0) {
        setUploading(true);

        for (const file of selectedFiles) {
          const url = await uploadFileWithProgress(file, chatId, setProgress);

          await addDoc(collection(db, "chats", chatId, "messages"), {
            senderId: auth.currentUser?.uid,
            type: file.type.startsWith("image/")
              ? "image"
              : file.type.startsWith("video/")
              ? "video"
              : "file",
            fileName: file.name,
            fileUrl: url,
            timestamp: serverTimestamp(),
          });
        }

        setSelectedFiles([]);
        setUploading(false);
        setProgress(0);
      }

      // Send text message
      if (trimmed) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          text: trimmed,
          senderId: auth.currentUser?.uid,
          type: "text",
          timestamp: serverTimestamp(),
        });
        setNewMsg("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setUploading(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50"
      }`}
    >
      {/* 🟢 Messages List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">No messages yet</div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            chatId={chatId}
            isOwn={msg.senderId === auth.currentUser?.uid}
          />
        ))}

        <div ref={bottomRef}></div>
      </div>

      {/* 🟢 Preview selected files */}
      {selectedFiles.length > 0 && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 border-t dark:border-gray-700">
          <div className="flex flex-wrap gap-3">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
              >
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    className="object-cover w-full h-full"
                  />
                ) : file.type.startsWith("video/") ? (
                  <video
                    src={URL.createObjectURL(file)}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-xs text-gray-600 dark:text-gray-300">
                    {file.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🟢 Upload progress bar */}
      {uploading && (
        <div className="p-3 flex items-center gap-3 bg-gray-200 dark:bg-gray-800 text-sm">
          <Spinner /> Uploading... {Math.round(progress * 100)}%
        </div>
      )}

      {/* 🟢 Input area */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <FileUploadButton onFileSelect={handleSelectFiles} />
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 rounded-full px-4 py-2 bg-gray-100 dark:bg-gray-700 focus:outline-none text-sm"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}