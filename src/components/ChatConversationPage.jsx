// src/components/Chat/ChatConversationPage.jsx
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
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";
import { UserContext } from "../../context/UserContext";
import { usePopup } from "../../context/PopupContext";

import ChatHeader from "./ChatHeader";
import MessageItem from "./MessageItem";
import ChatInput from "./ChatInput";

const COLORS = {
  primary: "#34B7F1",
  darkBg: "#0b0b0b",
  lightBg: "#f5f5f5",
  lightText: "#000",
  darkText: "#fff",
  mutedText: "#888",
};

// Format day label
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

// Format time (hh:mm AM/PM)
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
  const { uploadToCloudinary } = useContext(UserContext);
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
      const cRef = doc(db, "chats", chatId);
      const cSnap = await getDoc(cRef);

      if (cSnap.exists()) {
        const data = cSnap.data();
        setChatInfo({ id: cSnap.id, ...data });

        const friendId = data.participants?.find((p) => p !== myUid);

        if (friendId) {
          const uRef = doc(db, "users", friendId);
          unsubUser = onSnapshot(uRef, (s) => {
            if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
          });
        }
      }

      unsubChat = onSnapshot(cRef, (s) => {
        if (s.exists())
          setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
      });
    };

    loadMeta();
    return () => {
      unsubChat?.();
      unsubUser?.();
    };
  }, [chatId, myUid]);

  // -----------------------------
  // Realtime messages
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

      // Mark incoming messages as delivered
      docs.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            status: "delivered",
          });
        }
      });

      if (!isAtBottom) setShowScrollDown(true);
      else scrollToBottom(false);
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -----------------------------
  // Scroll listener
  // -----------------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const bottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(bottom);
      if (bottom) setShowScrollDown(false);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setIsAtBottom(true);
    setShowScrollDown(false);
  };

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2300);
  };

  // -----------------------------
  // Document uploads (B2)
  // -----------------------------
  const uploadToB2 = async (files) => {
    const uploaded = [];

    for (let file of files) {
      const tempId = Date.now() + "-" + file.name;

      setUploadProgress((p) => ({ ...p, [tempId]: 0 }));

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
          mediaType: "file",
        });

        setUploadProgress((p) => {
          const { [tempId]: _, ...rest } = p;
          return rest;
        });
      } catch (err) {
        console.error(err);
        triggerToast("Upload failed: " + file.name);
      }
    }
    return uploaded;
  };

  // -----------------------------
  // Cloudinary uploads (images, videos, audio)
  // -----------------------------
  const uploadCloudinaryMedia = async (files) => {
    const uploaded = [];

    for (let file of files) {
      try {
        const upload = await uploadToCloudinary(file);
        uploaded.push({
          tempId: Date.now() + "-" + file.name,
          fileName: file.name,
          url: upload.url,
          mediaType: upload.type, // image / video / audio
        });
      } catch {
        triggerToast("Media upload failed: " + file.name);
      }
    }

    return uploaded;
  };

  // -----------------------------
  // Sending messages
  // -----------------------------
  const sendTextMessage = async () => {
    if (!text && selectedFiles.length === 0) return;

    const docs = selectedFiles.filter(
      (f) =>
        !f.type.startsWith("image") &&
        !f.type.startsWith("video") &&
        !f.type.startsWith("audio")
    );

    const media = selectedFiles.filter(
      (f) =>
        f.type.startsWith("image") ||
        f.type.startsWith("video") ||
        f.type.startsWith("audio")
    );

    const uploadedDocs = await uploadToB2(docs);
    const uploadedMedia = await uploadCloudinaryMedia(media);

    const uploads = [...uploadedDocs, ...uploadedMedia];

    // Save uploaded files
    for (let item of uploads) {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text: "",
        mediaUrl: item.url,
        mediaType: item.mediaType,
        fileName: item.fileName,
        status: "sent",
        createdAt: serverTimestamp(),
        replyTo: replyTo?.id || null,
      });
    }

    // Save text message
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
  // Group messages by date
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
        backgroundColor:
          wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg),
        color: isDark ? COLORS.darkText : COLORS.lightText,
        position: "relative",
      }}
    >
      <ChatHeader
        chatInfo={chatInfo}
        friendInfo={friendInfo}
        myUid={myUid}
      />

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8 }}
      >
        {groupedMessages.map((item, idx) =>
          item.type === "day" ? (
            <div
              key={"day-" + idx}
              style={{
                textAlign: "center",
                fontSize: 12,
                color: COLORS.mutedText,
                margin: "12px 0",
              }}
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
            background: "#333",
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