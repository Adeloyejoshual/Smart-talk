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

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]); // 👈 store files before upload
  const bottomRef = useRef(null);

  // Load messages in real-time
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsub();
  }, [chatId]);

  // Send text or file message
  const sendMessage = async (e) => {
    e.preventDefault();

    // if user has selected files
    if (selectedFiles.length > 0) {
      await handleFileUpload(selectedFiles);
      setSelectedFiles([]);
      return;
    }

    const trimmed = newMsg.trim();
    if (!trimmed) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: trimmed,
      senderId: auth.currentUser.uid,
      type: "text",
      timestamp: serverTimestamp(),
    });

    setNewMsg("");
  };

  // Upload file(s) to AWS S3
  const handleFileUpload = async (files) => {
    try {
      setUploading(true);
      for (const file of files) {
        const url = await uploadFileWithProgress(file, chatId, setProgress);
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser.uid,
          type: "file",
          fileName: file.name,
          fileUrl: url,
          fileType: file.type,
          timestamp: serverTimestamp(),
        });
      }
      setUploading(false);
      setProgress(0);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploading(false);
      setProgress(0);
    }
  };

  // When user selects files (show preview)
  const handleFileSelect = (files) => {
    setSelectedFiles(Array.from(files));
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50"
      }`}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            No messages yet
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            chatId={chatId}
            isOwn={msg.senderId === auth.currentUser.uid}
          />
        ))}

        <div ref={bottomRef}></div>
      </div>

      {/* Uploading status */}
      {uploading && (
        <div className="p-3 flex items-center gap-3 bg-gray-200 dark:bg-gray-800 text-sm">
          <Spinner /> Uploading... {Math.round(progress * 100)}%
        </div>
      )}

      {/* Selected file preview */}
      {selectedFiles.length > 0 && (
        <div className="px-3 py-2 border-t dark:border-gray-700 flex gap-2 overflow-x-auto bg-gray-100 dark:bg-gray-800">
          {selectedFiles.map((file, i) => {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");
            return (
              <div
                key={i}
                className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden"
              >
                {isImage ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="object-cover w-full h-full"
                  />
                ) : isVideo ? (
                  <video
                    src={URL.createObjectURL(file)}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="bg-gray-300 dark:bg-gray-700 flex items-center justify-center w-full h-full text-xs text-gray-700 dark:text-gray-200">
                    {file.name.split(".").pop().toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <FileUploadButton onFileSelect={handleFileSelect} />
        <input
          type="text"
          placeholder={
            selectedFiles.length > 0
              ? "Press Send to upload file(s)"
              : "Type a message..."
          }
          className="flex-1 rounded-full px-4 py-2 bg-gray-100 dark:bg-gray-700 focus:outline-none text-sm"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          disabled={selectedFiles.length > 0}
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