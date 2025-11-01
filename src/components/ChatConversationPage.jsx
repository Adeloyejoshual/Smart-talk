import React, { useEffect, useState, useRef, useContext } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import EmojiPicker from "emoji-picker-react";
import MessageBubble from "./MessageBubble";
import MessageActionsMenu from "./MessageActionsMenu";
import ReactionBar from "./ReactionBar";
import FullScreenPreview from "./FullScreenPreview";
import ReplyPreview from "./ReplyPreview";
import HeaderActionsBar from "./HeaderActionsBar";
import TypingIndicator from "./TypingIndicator";
import { FiSend, FiPaperclip, FiSmile } from "react-icons/fi";
import { motion } from "framer-motion";

export default function ChatConversationPage() {
  const { theme } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const chatId = window.location.pathname.split("/").pop();
  const currentUser = auth.currentUser;
  const chatRef = doc(db, "chats", chatId);
  const messagesRef = collection(chatRef, "messages");
  const bottomRef = useRef(null);

  // 🔹 Fetch messages in realtime
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId]);

  // 🔹 Typing indicator (Firestore-based)
  useEffect(() => {
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.typing) setTypingUsers(data.typing);
      }
    });
    return () => unsub();
  }, [chatId]);

  const handleTyping = async (e) => {
    setInput(e.target.value);
    await updateDoc(chatRef, { [`typing.${currentUser.uid}`]: true });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await updateDoc(chatRef, { [`typing.${currentUser.uid}`]: false });
    }, 2000);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    await addDoc(messagesRef, {
      text: input,
      senderId: currentUser.uid,
      type: "text",
      timestamp: serverTimestamp(),
      replyTo: replyingTo ? replyingTo.id : null,
    });

    setInput("");
    setReplyingTo(null);
    setShowEmoji(false);
    await updateDoc(chatRef, { [`typing.${currentUser.uid}`]: false });
  };

  const handleEmojiClick = (emoji) => {
    setInput((prev) => prev + emoji.emoji);
  };

  const someoneElseTyping = Object.entries(typingUsers).some(
    ([uid, isTyping]) => uid !== currentUser.uid && isTyping
  );

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header / Action bar */}
      {selectedMessage ? (
        <HeaderActionsBar
          selectedMessage={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 border-b dark:border-gray-700">
          <button onClick={() => window.history.back()} className="text-xl">
            ←
          </button>
          <div>
            <h2 className="font-semibold text-base">Kude</h2>
            <p className="text-xs text-gray-400">
              {someoneElseTyping ? "Typing..." : "Online"}
            </p>
          </div>
          <div className="ml-auto flex gap-4 text-xl">
            <button onClick={() => (window.location.href = "/voice-call")}>
              📞
            </button>
            <button onClick={() => (window.location.href = "/video-call")}>
              🎥
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble
              message={msg}
              isOwn={msg.senderId === currentUser.uid}
              onLongPress={() => setSelectedMessage(msg)}
              onMediaClick={setFullscreenMedia}
              onReplyClick={(m) => setReplyingTo(m)}
            />
            <ReactionBar message={msg} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing Indicator */}
      {someoneElseTyping && <TypingIndicator />}

      {/* Reply Preview */}
      {replyingTo && (
        <ReplyPreview
          replyingTo={replyingTo}
          onCancel={() => setReplyingTo(null)}
        />
      )}

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t dark:border-gray-700 flex items-center gap-3"
      >
        <button type="button" onClick={() => setShowEmoji(!showEmoji)}>
          <FiSmile className="text-xl" />
        </button>
        <button type="button" className="text-xl">
          <FiPaperclip />
        </button>
        <input
          value={input}
          onChange={handleTyping}
          placeholder="Message..."
          className="flex-1 bg-transparent outline-none text-sm"
        />
        <button type="submit" className="text-blue-500">
          <FiSend className="text-xl" />
        </button>
      </form>

      {/* Emoji Picker */}
      {showEmoji && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-20 left-2"
        >
          <EmojiPicker onEmojiClick={handleEmojiClick} theme={theme} />
        </motion.div>
      )}

      {/* Fullscreen Media Preview */}
      {fullscreenMedia && (
        <FullScreenPreview
          media={fullscreenMedia}
          onClose={() => setFullscreenMedia(null)}
        />
      )}
    </div>
  );
}