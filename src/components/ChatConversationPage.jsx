// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  limit as fsLimit,
  getDoc
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";

const COLORS = {
  primary: "#34B7F1",
  darkBg: "#0b0b0b",
  lightBg: "#f5f5f5",
  lightText: "#000",
  darkText: "#fff",
  mutedText: "#888",
};

// Format date labels
const formatDayLabel = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// Format hh:mm
export const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [toast, setToast] = useState(null);

  // -----------------------------
  // Load chat & friend info
  // -----------------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const data = cSnap.data();
          setChatInfo({ id: cSnap.id, ...data });

          const friendId = data.participants?.find((p) => p !== myUid);
          if (friendId) {
            const userRef = doc(db, "users", friendId);
            unsubUser = onSnapshot(userRef, (s) => {
              if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
            });
          }
        }

        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists()) setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => {
      unsubChat?.();
      unsubUser?.();
    };
  }, [chatId, myUid]);

  // -----------------------------
  // Messages realtime
  // -----------------------------
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      fsLimit(2000)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !(m.deletedFor?.includes(myUid)));

      setMessages(docs);

      // mark delivered
      docs.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            status: "delivered",
          });
        }
      });

      if (messagesRefEl.current && !isAtBottom) setShowScrollDown(true);
      else scrollToBottom(false);
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -----------------------------
  // Scroll detection
  // -----------------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
      if (atBottom) setShowScrollDown(false);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setIsAtBottom(true);
    setShowScrollDown(false);
  };

  const triggerToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2300);
  };

  // -----------------------------
  // Upload images/videos to Cloudinary
  // -----------------------------
  const uploadToCloudinary = async (files) => {
    const uploaded = [];
    const cloudName = import.meta.env.VITE_CLOUDINARY_NAME;
    const preset = import.meta.env.VITE_CLOUDINARY_PRESET;

    for (let file of files) {
      const tempId = Date.now() + "-" + file.name;
      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", preset);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();

        uploaded.push({
          tempId,
          fileName: file.name,
          url: data.secure_url,
          mediaType: file.type.startsWith("image") ? "image" : "video",
        });

        setUploadProgress((prev) => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        triggerToast("Failed to upload media: " + file.name);
      }
    }
    return uploaded;
  };

  // -----------------------------
  // Upload docs/audio to B2
  // -----------------------------
  const uploadToB2 = async (files) => {
    const uploaded = [];
    for (let file of files) {
      const tempId = Date.now() + "-" + file.name;
      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

      try {
        const token = await auth.currentUser.getIdToken();
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload-b2", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (!data.url) throw new Error("Upload failed");

        uploaded.push({
          tempId,
          fileName: file.name,
          url: data.url,
          mediaType: file.type.startsWith("audio") ? "audio" : "file",
        });

        setUploadProgress((prev) => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      } catch (err) {
        console.error("B2 upload error:", err);
        triggerToast("Failed to upload: " + file.name);
      }
    }
    return uploaded;
  };

  // -----------------------------
  // Send message
  // -----------------------------
  const sendTextMessage = async () => {
    if (!text && selectedFiles.length === 0) return;

    const b2Files = selectedFiles.filter(
      (f) => !f.type.startsWith("image") && !f.type.startsWith("video")
    );
    const cloudFiles = selectedFiles.filter(
      (f) => f.type.startsWith("image") || f.type.startsWith("video")
    );

    const uploadedB2 = await uploadToB2(b2Files);
    const uploadedCloud = await uploadToCloudinary(cloudFiles);

    const allUploads = [...uploadedB2, ...uploadedCloud];

    for (let item of allUploads) {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text: "",
        mediaUrl: item.url,
        mediaType: item.mediaType,
        fileName: item.fileName,
        status: "sent",
        createdAt: serverTimestamp(),
        replyTo: replyTo?.id || null,
        tempId: item.tempId,
      });
    }

    if (text) {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text,
        mediaUrl: null,
        mediaType: null,
        status: "sent",
        createdAt: serverTimestamp(),
        replyTo: replyTo?.id || null,
      });
      setText("");
    }

    setSelectedFiles([]);
    setReplyTo(null);
    scrollToBottom();
  };

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files].slice(0, 30));
  };

  // -----------------------------
  // Group messages by day
  // -----------------------------
  const groupedMessages = [];
  let lastDate = null;
  messages.forEach((msg) => {
    const msgDate = formatDayLabel(msg.createdAt);
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: "day", label: msgDate });
      lastDate = msgDate;
    }
    groupedMessages.push({ type: "msg", data: msg });
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg),
        color: isDark ? COLORS.darkText : COLORS.lightText,
        position: "relative",
      }}
    >
      <ChatHeader chatInfo={chatInfo} friendInfo={friendInfo} myUid={myUid} />

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, position: "relative" }}
      >
        {groupedMessages.map((item, idx) =>
          item.type === "day" ? (
            <div
              key={`day-${idx}`}
              style={{ textAlign: "center", fontSize: 12, color: COLORS.mutedText, margin: "12px 0" }}
            >
              {item.label}
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              chatId={chatId}
              isDark={isDark}
              uploadProgress={uploadProgress}
              replyToMessage={setReplyTo}
              fmtTime={fmtTime}
              showPopup={showPopup}
            />
          )
        )}
        <div ref={endRef} />
      </div>

      {showScrollDown && !isAtBottom && (
        <button
          onClick={() => scrollToBottom()}
          style={{
            position: "absolute",
            bottom: 80,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: COLORS.primary,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            zIndex: 50,
          }}
        >
          ↓
        </button>
      )}

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        onFilesSelected={onFilesSelected}
        holdStart={() => {}}
        holdEnd={() => {}}
        recording={false}
        isDark={isDark}
      />

      {toast && (
        <div
          style={{
            position: "absolute",
            top: 65,
            left: "50%",
            transform: "translateX(-50%)",
            background: isDark ? "#333" : "#222",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 20,
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            opacity: 0.95,
            zIndex: 999,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}