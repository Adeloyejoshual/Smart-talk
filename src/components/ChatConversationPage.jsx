import React, { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db, storage } from "../firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import MessageBubble from "./Chat/MessageBubble";
import ReactionBar from "./Chat/ReactionBar";
import AllEmojiPicker from "./Chat/AllEmojiPicker";
import MultiSelectBar from "./Chat/MultiSelectBar";
import Spinner from "./Chat/Spinner";
import FileUploadButton from "./Chat/FileUploadButton";

export default function ChatConversationPage({ chatId, user, chatName }) {
  const [messages, setMessages] = useState([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, snapshot => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      scrollToBottom();
    });
    return unsubscribe;
  }, [chatId]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: inputValue,
      userId: user.uid,
      timestamp: serverTimestamp(),
      reactions: []
    });
    setInputValue("");
  };

  const addReaction = async (messageId, emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", messageId);
    const message = messages.find(m => m.id === messageId);
    const existing = message.reactions.find(r => r.emoji === emoji);
    const newReactions = existing
      ? message.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r)
      : [...message.reactions, { emoji, count: 1 }];
    await updateDoc(msgRef, { reactions: newReactions });
  };

  const uploadFile = async (file) => {
    setLoading(true);
    const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on("state_changed", null, console.error, async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "",
        file: url,
        fileName: file.name,
        userId: user.uid,
        timestamp: serverTimestamp(),
        reactions: []
      });
      setLoading(false);
      scrollToBottom();
    });
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10 shadow">
        <h2 className="font-semibold">{chatName}</h2>
        <div className="flex gap-4">
          <button className="text-blue-600 font-bold">📞</button>
          <button className="text-blue-600 font-bold">🎥</button>
        </div>
      </div>

      {/* Multi-select bar */}
      {selectedMessageIds.length > 0 && <MultiSelectBar selectedMessageIds={selectedMessageIds} />}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-2 bg-gray-50">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === user.uid}
            isSelected={selectedMessageIds.includes(msg.id)}
            onSelect={() => setSelectedMessageIds(prev =>
              prev.includes(msg.id) ? prev.filter(id => id !== msg.id) : [...prev, msg.id]
            )}
            onReact={emoji => addReaction(msg.id, emoji)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-center p-2 border-t bg-white sticky bottom-0 z-10">
        <FileUploadButton onUpload={uploadFile} />
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 mx-2 p-2 border rounded"
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <button onClick={() => setShowEmojiPicker(prev => !prev)} className="text-xl">😊</button>
      </div>

      {showEmojiPicker && selectedMessageIds.length > 0 && (
        <AllEmojiPicker onSelect={emoji => addReaction(selectedMessageIds[0], emoji)} />
      )}

      {loading && <Spinner />}
    </div>
  );
}