import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import FileUploadButton from "./Chat/FileUploadButton";
import { uploadFileWithProgress } from "../awsS3";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const bottomRef = useRef();

  // Load messages
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, snapshot => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId]);

  const sendMessage = async e => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: newMsg,
      type: "text",
      senderId: auth.currentUser.uid,
      timestamp: serverTimestamp(),
    });
    setNewMsg("");
  };

  const handleFileUpload = async (file) => {
    try {
      setUploading(true);
      const url = await uploadFileWithProgress(file, chatId, setProgress);

      await addDoc(collection(db, "chats", chatId, "messages"), {
        fileName: file.name,
        fileUrl: url,
        type: "file",
        senderId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
      });

      setUploading(false);
      setProgress(0);
    } catch (err) {
      console.error("Upload error:", err);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.type === "text" ? (
              <div>{msg.text}</div>
            ) : (
              <a href={msg.fileUrl} target="_blank">{msg.fileName}</a>
            )}
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      {uploading && <div className="p-2">Uploading... {Math.round(progress * 100)}%</div>}

      <form onSubmit={sendMessage} className="flex items-center gap-2 p-3 border-t">
        <FileUploadButton onFileSelect={handleFileUpload} />
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 rounded-full px-4 py-2 border"
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-full">Send</button>
      </form>
    </div>
  );
}