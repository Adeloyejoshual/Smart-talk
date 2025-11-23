// src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  limit as fsLimit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
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
  grayBorder: "rgba(0,0,0,0.06)",
  darkCard: "#1b1b1b",
  lightCard: "#fff",
};

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

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
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
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // -------------------- Load chat & friend --------------------
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
          if (s.exists())
            setChatInfo((prev) => ({ ...(prev || {}), ...s.data() }));
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

  // -------------------- Messages realtime --------------------
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

      // Count new messages if not at bottom
      if (!isAtBottom) {
        const incoming = docs.filter(
          (m) => m.senderId !== myUid && !m.read
        ).length;
        setNewMsgCount(incoming);
        setShowScrollDown(incoming > 0);
        setTimeout(() => setShowScrollDown(false), 5000);
      }

      setMessages(docs);

      // Mark incoming as delivered
      docs.forEach(async (m) => {
        if (m.senderId !== myUid && m.status === "sent") {
          await updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            status: "delivered",
          });
        }
      });

      if (isAtBottom) scrollToBottom();
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
      if (atBottom) setNewMsgCount(0);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = (smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setIsAtBottom(true);
    setNewMsgCount(0);
    setShowScrollDown(false);
  };

  // -------------------- Send Text Message --------------------
  const sendTextMessage = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;
    if (!chatInfo || (chatInfo.blockedBy || []).includes(myUid))
      return alert("You are blocked in this chat.");

    if (text.trim()) {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        text: text.trim(),
        mediaUrl: null,
        mediaType: null,
        status: "sent",
        createdAt: serverTimestamp(),
        replyTo: replyTo?.id || null,
      });
      setText("");
      setReplyTo(null);
      scrollToBottom();
    }
  };

  // -------------------- Send Media Message --------------------
  const sendMediaMessage = async (files) => {
    if (!chatInfo || (chatInfo.blockedBy || []).includes(myUid))
      return alert("You are blocked in this chat.");

    for (const file of files) {
      const tempId = Date.now() + "-" + file.name;

      // 1️⃣ Optimistic UI
      const tempMessage = {
        tempId,
        senderId: myUid,
        text: "",
        mediaUrl: URL.createObjectURL(file),
        mediaType: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
          ? "video"
          : "file",
        fileName: file.name,
        status: "sending",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, tempMessage]);

      // 2️⃣ Upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "0HoyRB6wC0eba-Cbat0nhiIRoa8");
      formData.append("folder", "chatImages");

      try {
        const res = await fetch(
          "https://api.cloudinary.com/v1_1/dtp8wg4e1/image/upload",
          { method: "POST", body: formData }
        );
        const data = await res.json();
        const fileURL = data.secure_url;

        const docRef = await addDoc(
          collection(db, "chats", chatId, "messages"),
          {
            senderId: myUid,
            text: "",
            mediaUrl: fileURL,
            mediaType: "image",
            status: "sent",
            createdAt: serverTimestamp(),
          }
        );

        // 3️⃣ Update temp message
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId
              ? { ...m, mediaUrl: fileURL, status: "sent", id: docRef.id }
              : m
          )
        );
      } catch (err) {
        console.error("Upload failed", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId ? { ...m, status: "failed" } : m
          )
        );
      }
    }

    scrollToBottom();
  };

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  // -------------------- Group messages by day --------------------
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
      <ChatHeader
        chatInfo={chatInfo}
        friendInfo={friendInfo}
        myUid={myUid}
        navigate={navigate}
        headerMenuOpen={false}
        setHeaderMenuOpen={() => {}}
      />

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, position: "relative" }}
      >
        {groupedMessages.map((item, idx) =>
          item.type === "day" ? (
            <div
              key={`day-${idx}`}
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
              key={item.data.id || item.data.tempId}
              message={item.data}
              myUid={myUid}
              menuOpenFor={menuOpenFor}
              setMenuOpenFor={setMenuOpenFor}
              reactionFor={reactionFor}
              setReactionFor={setReactionFor}
              applyReaction={() => {}}
              replyToMessage={(m) => setReplyTo(m)}
              uploadProgress={uploadProgress}
            />
          )
        )}
        <div ref={endRef} />
      </div>

      {/* Scroll down button */}
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
          {newMsgCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                backgroundColor: "red",
                color: "#fff",
                fontSize: 12,
                fontWeight: "bold",
                borderRadius: "50%",
                padding: "2px 6px",
              }}
            >
              {newMsgCount}
            </span>
          )}
        </button>
      )}

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        sendMediaMessage={sendMediaMessage} // <-- NEW
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        onFilesSelected={onFilesSelected}
        holdStart={() => {}}
        holdEnd={() => {}}
        recording={recording}
        isDark={isDark}
      />
    </div>
  );
}