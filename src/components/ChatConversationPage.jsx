import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/firebase";
import { Send, Paperclip, File, Music, Loader2 } from "lucide-react";

export default function ChatConversationPage({ chatId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef();

  // 🔥 Fetch messages live from Firestore
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatId]);

  // 🖼️ Handle file selection
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

  // ☁️ Upload file to Cloudinary
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

  // 📁 Detect file type (image, video, pdf, audio, etc.)
  const detectFileType = (file) => {
    const type = file.type;
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type === "application/pdf") return "pdf";
    if (type.startsWith("audio/")) return "audio";
    return "file";
  };

  // ✉️ Send message (text or media)
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

  // 💬 Render message content dynamically
  const renderMessageContent = (msg) => {
    if (msg.mediaUrl) {
      switch (msg.mediaType) {
        case "image":
          return <img src={msg.mediaUrl} alt="sent" className="rounded-lg max-h-60" />;
        case "video":
          return <video controls src={msg.mediaUrl} className="rounded-lg max-h-60" />;
        case "pdf":
          return (
            <a
              href={msg.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-red-500 underline"
            >
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
            <a
              href={msg.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-500 underline"
            >
              <File className="mr-2 text-blue-500" /> Download File
            </a>
          );
      }
    }
    return <p className="text-gray-800 dark:text-gray-100">{msg.text}</p>;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Chat messages */}
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

        {/* Upload preview */}
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
      </div>

      {/* Input area */}
      <div className="flex items-center p-3 border-t bg-white dark:bg-gray-800">
        <label className="cursor-pointer mr-3">
          <Paperclip size={22} className="text-gray-500" />
          <input type="file" hidden ref={fileInputRef} onChange={handleFileSelect} />
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