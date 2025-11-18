import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import EmojiPicker from "emoji-picker-react";
import { IoCloseSharp } from "react-icons/io5";
import { MdOutlineClose } from "react-icons/md";
import { FaRegTrashAlt } from "react-icons/fa";
import { IoReplyOutline } from "react-icons/io5";
import { IoIosSend } from "react-icons/io";
import { RiImageAddFill, RiVideoAddFill } from "react-icons/ri";
import { LuAudioLines } from "react-icons/lu";
import { GoGoal } from "react-icons/go";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const messageListRef = useRef(null);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(null);

  const menuBtnStyle = {
    padding: "10px 12px",
    width: "100%",
    border: "none",
    background: "transparent",
    fontSize: 15,
    textAlign: "left",
    cursor: "pointer",
  };

  const currentUser = auth.currentUser;

  // ---------------------------
  // Detect file type
  // ---------------------------
  const detectFileType = (file) => {
    if (!file) return "raw";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "raw";
  };

  // ---------------------------
  // Upload file to Cloudinary
  // ---------------------------
  const uploadToCloudinary = async (file, type) => {
    const cloudName = "dwgij8wdp";
    const uploadPreset = "chat_media";

    const safeType = ["image", "video", "audio"].includes(type)
      ? type
      : "raw";

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${safeType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Cloudinary upload failed");

    return await res.json();
  };

  // ---------------------------
  // Choose files
  // ---------------------------
  const handleFiles = (ev) => {
    const files = Array.from(ev.target.files);
    const previews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: detectFileType(file),
    }));
    setAttachments((prev) => [...prev, ...previews]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------------------
  // Auto scroll
  // ---------------------------
  const scrollToBottom = () => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop =
      messageListRef.current.scrollHeight;
  };

  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages]);

  const handleScroll = () => {
    if (!messageListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messageListRef.current;
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 20);
  };

  // ---------------------------
  // Listen to messages
  // ---------------------------
  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || null,
      }));
      setMessages(data);
    });

    return () => unsub();
  }, []);

  // ---------------------------
  // Send message
  // ---------------------------
  const sendMessage = async () => {
    if (cooldown) return;

    if (!inputValue.trim() && attachments.length === 0) return;

    setCooldown(true);
    setTimeout(() => setCooldown(false), 500);

    let uploaded = [];

    try {
      for (const item of attachments) {
        const result = await uploadToCloudinary(item.file, item.type);
        uploaded.push({
          url: result.secure_url,
          type: item.type,
        });
      }

      await addDoc(collection(db, "messages"), {
        text: inputValue.trim() || "",
        attachments: uploaded,
        senderId: currentUser?.uid,
        timestamp: serverTimestamp(),
        replyTo: replyTo || null,
      });

      setInputValue("");
      setAttachments([]);
      setReplyTo(null);
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  // ---------------------------
  // Long press menu
  // ---------------------------
  const handleMsgMouseDown = (m) => {
    longPressTimer.current = setTimeout(
      () => setMenuOpenFor(m.id),
      600
    );
  };

  const clearLongPress = () => {
    clearTimeout(longPressTimer.current);
  };

  // ---------------------------
  // Swipe to reply
  // ---------------------------
  const handleMsgTouchStart = (ev) => {
    swipeStartX.current = ev.touches[0].clientX;
    longPressTimer.current = setTimeout(() => {
      setMenuOpenFor(m.id);
    }, 600);
  };

  const handleMsgTouchEnd = (m, ev) => {
    clearTimeout(longPressTimer.current);
    if (!swipeStartX.current) return;

    const endX = ev.changedTouches?.[0]?.clientX || 0;
    const dist = Math.abs(endX - swipeStartX.current);

    if (dist > 60) {
      setReplyTo({
        id: m.id,
        text:
          m.text?.slice(0, 40) ||
          (m.attachments?.length ? "[Media]" : ""),
        senderId: m.senderId,
      });
    }
    swipeStartX.current = null;
  };

  // ---------------------------
  // Delete
  // ---------------------------
  const handleDeleteMessage = async (id) => {
    try {
      await deleteDoc(doc(db, "messages", id));
      setMenuOpenFor(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------------------
  // Reply target UI
  // ---------------------------
  const replyTarget = useMemo(() => {
    if (!replyTo) return null;

    const m = messages.find((x) => x.id === replyTo.id);
    if (!m) return null;

    return (
      <div
        style={{
          padding: 10,
          marginBottom: 5,
          background: "#e5e7eb",
          borderLeft: "4px solid #4b5563",
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>
            {m.senderId === currentUser?.uid
              ? "You"
              : "Other"}
          </strong>
          <div>{m.text || "[Media]"}</div>
        </div>
        <button
          onClick={() => setReplyTo(null)}
          style={{ background: "transparent", border: "none" }}
        >
          <MdOutlineClose size={22} />
        </button>
      </div>
    );
  }, [replyTo, messages]);

  // ---------------------------
  // Message bubble
  // ---------------------------
  const MessageBubble = ({ m }) => {
    const isMe = m.senderId === currentUser?.uid;

    return (
      <div
        className={`msg-row ${isMe ? "me" : "them"}`}
        style={{ position: "relative" }}
        onTouchStart={(ev) => handleMsgTouchStart(ev)}
        onTouchEnd={(ev) => handleMsgTouchEnd(m, ev)}
        onMouseDown={() => handleMsgMouseDown(m)}
        onMouseUp={clearLongPress}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <div
          className="msg-bubble"
          style={{
            background: isMe ? "#2563eb" : "#f3f4f6",
            color: isMe ? "white" : "black",
            padding: "10px 14px",
            borderRadius: 16,
            maxWidth: "75%",
          }}
        >
          {m.replyTo && (
            <div
              style={{
                borderLeft: "3px solid #6b7280",
                paddingLeft: 8,
                marginBottom: 6,
                opacity: 0.8,
                fontSize: 12,
              }}
            >
              Replying:{" "}
              {m.replyTo.text || "[Media]"}
            </div>
          )}

          {m.text && <div>{m.text}</div>}

          {m.attachments?.map((a, i) => (
            <div key={i} style={{ marginTop: 6 }}>
              {a.type === "image" && (
                <img
                  src={a.url}
                  alt=""
                  style={{
                    width: 180,
                    borderRadius: 10,
                  }}
                />
              )}
              {a.type === "video" && (
                <video
                  src={a.url}
                  controls
                  style={{
                    width: 200,
                    borderRadius: 10,
                    background: "black",
                  }}
                />
              )}
              {a.type === "audio" && (
                <audio controls src={a.url} />
              )}
            </div>
          ))}
        </div>

        {/* Long-press menu */}
        {menuOpenFor === m.id && (
          <div
            style={{
              position: "absolute",
              right: isMe ? 0 : "auto",
              left: isMe ? "auto" : 0,
              top: 0,
              background: "white",
              padding: 6,
              borderRadius: 10,
              boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
              zIndex: 99,
              width: 120,
            }}
          >
            <button
              style={menuBtnStyle}
              onClick={() => {
                setReplyTo({
                  id: m.id,
                  text:
                    m.text?.slice(0, 40) ||
                    "[Media]",
                  senderId: m.senderId,
                });
                setMenuOpenFor(null);
              }}
            >
              Reply
            </button>

            {isMe && (
              <button
                style={menuBtnStyle}
                onClick={() => handleDeleteMessage(m.id)}
              >
                Delete
              </button>
            )}

            <button
              style={menuBtnStyle}
              onClick={() => setMenuOpenFor(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------
  // MAIN RENDER
  // ---------------------------
  return (
    <div className="chat-page">
      {/* Header */}
      <header className="chat-header">
        <GoGoal size={28} />
        <h2>Chat</h2>
      </header>

      {/* Message list */}
      <main
        className="message-list"
        ref={messageListRef}
        onScroll={handleScroll}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}
      </main>

      {/* Reply preview */}
      {replyTarget}

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 6,
            padding: 5,
            overflowX: "auto",
          }}
        >
          {attachments.map((a, i) => (
            <div key={i} style={{ position: "relative" }}>
              {a.type === "image" && (
                <img
                  src={a.url}
                  alt=""
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 10,
                  }}
                />
              )}
              {a.type === "video" && (
                <video
                  src={a.url}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                    background: "black",
                  }}
                />
              )}
              {a.type === "audio" && (
                <div
                  style={{
                    width: 100,
                    height: 70,
                    borderRadius: 10,
                    background: "#ddd",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  Audio
                </div>
              )}

              <button
                onClick={() => removeAttachment(i)}
                style={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  background: "white",
                  borderRadius: "50%",
                  border: "1px solid #ccc",
                }}
              >
                <IoCloseSharp />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <footer className="chat-input">
        <label>
          <RiImageAddFill size={26} />
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFiles}
          />
        </label>

        <label>
          <RiVideoAddFill size={28} />
          <input
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={handleFiles}
          />
        </label>

        <label>
          <LuAudioLines size={26} />
          <input
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={handleFiles}
          />
        </label>

        <input
          className="msg-input"
          placeholder="Type a message…"
          value={inputValue}
          onChange={(ev) => setInputValue(ev.target.value)}
        />

        <button onClick={sendMessage} className="send-btn">
          <IoIosSend size={26} />
        </button>
      </footer>
    </div>
  );
}