import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { ArrowDown, Phone, Video, ArrowLeft } from "lucide-react";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [friendInfo, setFriendInfo] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendTyping, setFriendTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const isDark = theme === "dark";

  // ✅ Load chat + friend info
  useEffect(() => {
    if (!chatId) return;

    (async () => {
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const friendId = chatData.participants.find(
          (uid) => uid !== auth.currentUser.uid
        );
        const friendRef = doc(db, "users", friendId);
        onSnapshot(friendRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setFriendInfo({ id: snap.id, ...data });
            setFriendTyping(data?.typing?.[chatId]);
          }
        });
      }
    })();
  }, [chatId]);

  // ✅ Load messages
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (!isAtBottom && msgs.length > messages.length) {
        setUnreadCount((prev) => prev + (msgs.length - messages.length));
      }

      setMessages(msgs);
      if (isAtBottom) scrollToBottom();
    });

    return () => unsubscribe();
  }, [chatId, isAtBottom, messages.length]);

  // ✅ Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadCount(0);
  };

  // ✅ Handle scroll
  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      80;
    setIsAtBottom(nearBottom);
    if (nearBottom) setUnreadCount(0);
  };

  // ✅ Format last seen / typing
  const formatLastSeen = () => {
    if (!friendInfo) return "";
    if (friendInfo.isOnline) return "Online";
    if (friendTyping) return "typing...";
    if (!friendInfo.lastSeen) return "";
    const last = friendInfo.lastSeen.toDate
      ? friendInfo.lastSeen.toDate()
      : new Date(friendInfo.lastSeen);
    const diff = Math.floor((Date.now() - last.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return last.toLocaleDateString();
  };

  // ✅ Send message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: newMessage.trim(),
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
    scrollToBottom();
  };

  return (
    <div
      className={`flex flex-col h-screen ${
        isDark ? "bg-gray-900 text-white" : "bg-white text-black"
      }`}
    >
      {/* ✅ Fixed Header */}
      <div
        className={`sticky top-0 z-20 flex items-center justify-between px-3 py-2 shadow-md ${
          isDark ? "bg-gray-800 border-b border-gray-700" : "bg-white border-b"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="text-xl hover:opacity-75"
          >
            <ArrowLeft size={22} />
          </button>
          <img
            src={friendInfo?.photoURL || "/default-avatar.png"}
            alt="avatar"
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
            onClick={() =>
              friendInfo && navigate(`/user-profile/${friendInfo.id}`)
            }
          />
          <div>
            <h4 className="font-semibold">
              {friendInfo?.displayName || "User"}
            </h4>
            <small
              className={`text-sm ${
                friendTyping ? "text-green-400" : "text-gray-400"
              }`}
            >
              {formatLastSeen()}
            </small>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/voice-call/${chatId}`)}
            title="Voice Call"
          >
            <Phone size={20} />
          </button>
          <button
            onClick={() => navigate(`/video-call/${chatId}`)}
            title="Video Call"
          >
            <Video size={20} />
          </button>
        </div>
      </div>

      {/* ✅ Scrollable Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 mb-[72px]"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[75%] p-3 rounded-2xl break-words ${
              msg.senderId === auth.currentUser.uid
                ? "bg-blue-500 text-white ml-auto"
                : "bg-gray-200 text-black"
            }`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ✅ Floating Down Button */}
      {!isAtBottom && (
        <div className="fixed bottom-[90px] right-5 flex flex-col items-end space-y-2 animate-fadeIn">
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white text-sm px-3 py-1 rounded-full shadow-md">
              {unreadCount} new message{unreadCount > 1 ? "s" : ""} ↓
            </div>
          )}
          <button
            onClick={scrollToBottom}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300"
          >
            <ArrowDown size={22} />
          </button>
        </div>
      )}

      {/* ✅ Fixed Input */}
      <form
        onSubmit={handleSend}
        className={`fixed bottom-0 w-full flex items-center gap-2 px-3 py-2 border-t z-20 ${
          isDark
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}