import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../firebaseConfig";
import MessageBubble from "./Chat/MessageBubble";
import FileUploadButton from "./Chat/FileUploadButton";
import Spinner from "./Chat/Spinner";
import { uploadFileWithProgress } from "../awsS3"; // optional — file provided earlier

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // File objects
  const [previews, setPreviews] = useState([]); // {url, type, name}
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const endRef = useRef(null);

  // realtime messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(docs);
    });
    return () => unsub();
  }, [chatId]);

  // scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // handle files chosen by FileUploadButton
  const handleFilesSelected = (files) => {
    const arr = Array.from(files || []);
    const newPreviews = arr.map(f => ({ url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null, type: f.type, name: f.name, file: f }));
    setSelectedFiles(prev => [...prev, ...arr]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  // remove preview
  const removePreview = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // upload single file (supports either S3 or Firebase Storage)
  const uploadSingle = async (file, onProgress) => {
    // if env flag USE_S3 is true use awsS3 upload helper (you included earlier)
    if (process.env.REACT_APP_USE_S3 === "true" && typeof uploadFileWithProgress === "function") {
      // uploadFileWithProgress(file, chatId, onProgress) => returns url
      return await uploadFileWithProgress(file, chatId, (p) => onProgress && onProgress(p));
    }

    // fallback: Firebase Storage
    const path = `chats/${chatId}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);

    return await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          const p = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
          onProgress && onProgress(p);
        },
        (err) => reject(err),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (e) { reject(e); }
        }
      );
    });
  };

  // send message (text + files)
  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!chatId) return;

    // nothing to send
    if (!input.trim() && selectedFiles.length === 0) return;

    try {
      setUploading(true);

      // 1) If text present, create text message first (optimistic)
      if (input.trim()) {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type: "text",
          text: input.trim(),
          timestamp: serverTimestamp(),
        });
        setInput("");
      }

      // 2) Upload files sequentially (or change to parallel if desired)
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgress(0);
        const url = await uploadSingle(file, (p) => setProgress(p));
        // message type based on mime
        let msgType = "file";
        if (file.type.startsWith("image/")) msgType = "image";
        else if (file.type.startsWith("video/")) msgType = "video";

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: auth.currentUser?.uid || null,
          type: msgType,
          fileUrl: url,
          fileName: file.name,
          fileType: file.type,
          timestamp: serverTimestamp(),
        });
      }

      // clear previews after send
      setSelectedFiles([]);
      // revoke object URLs
      previews.forEach(p => p.url && URL.revokeObjectURL(p.url));
      setPreviews([]);
      setProgress(0);

    } catch (err) {
      console.error("send error", err);
      alert("Failed to send. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header could be moved to separate component */}

      {/* messages area */}
      <div className="flex-1 overflow-auto p-3">
        {messages.map(m => (
          <MessageBubble key={m.id} msg={m} isOwn={m.senderId === auth.currentUser?.uid} />
        ))}
        <div ref={endRef} />
      </div>

      {/* previews (small thumbnails above input) */}
      {previews.length > 0 && (
        <div className="p-2 border-t bg-gray-50 dark:bg-gray-800 flex gap-2 items-center overflow-x-auto">
          {previews.map((p, idx) => (
            <div key={idx} className="relative w-20 h-20 flex-shrink-0">
              {p.url ? (
                <img src={p.url} alt={p.name} className="w-full h-full object-cover rounded" />
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-xs p-1">{p.name}</div>
              )}
              <button onClick={() => removePreview(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs">×</button>
            </div>
          ))}
        </div>
      )}

      {/* upload progress */}
      {uploading && (
        <div className="p-2 text-xs text-center bg-gray-100 dark:bg-gray-800">
          Uploading {Math.round(progress * 100)}%
        </div>
      )}

      {/* composer */}
      <form onSubmit={handleSend} className="p-3 border-t bg-white dark:bg-gray-800 flex items-center gap-2">
        <FileUploadButton onFileSelect={handleFilesSelected} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={uploading ? "Uploading..." : "Type a message"}
          className="flex-1 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-sm outline-none"
          disabled={uploading}
        />
        <button type="submit" disabled={uploading || (!input.trim() && selectedFiles.length === 0)} className="bg-blue-500 text-white px-4 py-2 rounded-full disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}