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
  arrayUnion,
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
  headerBlue: "#1877F2",
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
  const [recording, setRecording] = useState(false);

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
      setMessages(docs);

      // mark incoming messages as delivered
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
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  };

  // -------------------- Send message --------------------
  const sendTextMessage = async () => {
    if (!chatInfo || (chatInfo.blockedBy || []).includes(myUid))
      return alert("You are blocked in this chat.");
    if (!text && selectedFiles.length === 0) return;

    // Upload files
    for (let file of selectedFiles) {
      const tempId = Date.now() + "-" + file.name;
      setUploadProgress((prev) => ({ ...prev, [tempId]: 0 }));

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

        await addDoc(collection(db, "chats", chatId, "messages"), {
          senderId: myUid,
          text: "",
          mediaUrl: fileURL,
          mediaType: "image",
          status: "sent",
          createdAt: serverTimestamp(),
          replyTo: replyTo?.id || null,
          tempId,
        });

        setUploadProgress((prev) => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });
      } catch (e) {
        console.error("File upload error:", e);
      }
    }

    // Send text
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
    }

    setText("");
    setSelectedFiles([]);
    setReplyTo(null);
    scrollToBottom();
  };

  const onFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? COLORS.darkBg : COLORS.lightBg),
        color: isDark ? COLORS.darkText : COLORS.lightText,
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

      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            myUid={myUid}
            menuOpenFor={menuOpenFor}
            setMenuOpenFor={setMenuOpenFor}
            reactionFor={reactionFor}
            setReactionFor={setReactionFor}
            applyReaction={() => {}}
            replyToMessage={(m) => setReplyTo(m)}
            uploadProgress={uploadProgress}
          />
        ))}
        <div ref={endRef} />
      </div>

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
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