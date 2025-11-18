// Full fixed ChatConversationPage.jsx import React, { useEffect, useState, useRef, useContext } from "react"; import { ThemeContext } from "../context/ThemeContext"; import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from "firebase/firestore"; import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"; import { db, storage } from "../firebaseConfig"; import Header from "./Chat/Header"; import MessageList from "./Chat/MessageList"; import MessageInput from "./Chat/MessageInput";

export default function ChatConversationPage({ chatId }) { const { theme } = useContext(ThemeContext); const [messages, setMessages] = useState([]); const scrollRef = useRef();

// Load old + realtime messages useEffect(() => { const q = query( collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc") );

const unsub = onSnapshot(q, (snap) => {
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  setMessages(list);

  setTimeout(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, 100);
});

return () => unsub();

}, [chatId]);

// Send text const sendText = async (text) => { await addDoc(collection(db, "chats", chatId, "messages"), { text, type: "text", sender: "me", timestamp: serverTimestamp(), }); };

// Upload files const uploadFileMessage = async (file, type) => { const placeholder = { type, sender: "me", timestamp: serverTimestamp(), uploading: true, progress: 0, };

const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), placeholder);
const storageRef = ref(storage, `uploads/${chatId}/${msgRef.id}`);

const uploadTask = uploadBytesResumable(storageRef, file);

uploadTask.on(
  "state_changed",

  (snap) => {
    const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
    updateDoc(doc(db, "chats", chatId, "messages", msgRef.id), { progress });
  },

  () => {
    updateDoc(doc(db, "chats", chatId, "messages", msgRef.id), {
      uploading: false,
      error: true,
    });
  },

  async () => {
    const url = await getDownloadURL(uploadTask.snapshot.ref);
    updateDoc(doc(db, "chats", chatId, "messages", msgRef.id), {
      uploading: false,
      progress: null,
      url,
    });
  }
);

};

const sendImage = (f) => uploadFileMessage(f, "image"); const sendVoice = (f) => uploadFileMessage(f, "voice"); const sendVideo = (f) => uploadFileMessage(f, "video");

return ( <div className={chat-page ${theme}}> <Header chatId={chatId} />

<div className="chat-scroll" ref={scrollRef}>
    <MessageList messages={messages} />
  </div>

  <div className="chat-input-container">
    <MessageInput
      onSend={sendText}
      onSendImage={sendImage}
      onSendVoice={sendVoice}
      onSendVideo={sendVideo}
    />
  </div>
</div>

); }
