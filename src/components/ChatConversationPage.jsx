// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

import MessageBubble from "./MessageBubble";
import ReactionBar from "./ReactionBar";
import AllEmojiPicker from "./AllEmojiPicker";
import MultiSelectBar from "./MultiSelectBar";
import Spinner from "./Spinner";

import { uploadFileToS3 } from "../awsS3"; // your S3 upload function

export const INLINE_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
export const EXTENDED_EMOJIS = [
  "❤️","😂","👍","😮","😢","👎","👏","🔥","😅","🤩",
  "😍","😎","🙂","🙃","😉","🤔","🤨","🤗","🤯","🥳","🙏","💪"
];

// Helper
export const fmtTime = ts => ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour:"numeric", minute:"2-digit" }) : "";
export const dayLabel = ts => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [localUploads, setLocalUploads] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesRef = useRef(null);
  const endRef = useRef(null);

  // Load chat & friend
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubFriend=null, unsubChat=null;

    (async () => {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) { alert("Chat not found"); navigate("/chat"); return; }
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });

      const friendId = data.participants?.find(p => p!==myUid);
      if (friendId) {
        const friendRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(friendRef, fsnap => fsnap.exists() && setFriendInfo({id: fsnap.id,...fsnap.data()}));
      }
      unsubChat = onSnapshot(chatRef, csnap => csnap.exists() && setChatInfo(prev=>({...prev,...csnap.data()})));
    })();

    return ()=>{ unsubFriend && unsubFriend(); unsubChat && unsubChat(); }
  }, [chatId, myUid, navigate]);

  // Load messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt","desc"), fsLimit(50));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      setMessages(docs);
      setTimeout(()=>endRef.current?.scrollIntoView({behavior:"auto"}),50);
    });
    return ()=>unsub();
  }, [chatId]);

  const sendMessage = async () => {
    if (!text.trim() && !selectedFiles.length) return;
    // Send text
    if (text.trim()) {
      await addDoc(collection(db,"chats",chatId,"messages"),{
        sender: myUid,
        text,
        createdAt: serverTimestamp(),
        type:"text",
        status:"sent"
      });
      setText("");
    }
    // Send files
    for (const file of selectedFiles) {
      const placeholder = await addDoc(collection(db,"chats",chatId,"messages"),{
        sender: myUid,
        text:"",
        type: file.type.startsWith("image/") ? "image":"file",
        fileName:file.name,
        status:"uploading",
        createdAt: serverTimestamp()
      });
      const url = await uploadFileToS3(file, chatId);
      await updateDoc(doc(db,"chats",chatId,"messages",placeholder.id),{
        fileURL: url,
        status:"sent"
      });
    }
    setSelectedFiles([]); setPreviews([]);
    endRef.current?.scrollIntoView({behavior:"smooth"});
  };

  return (
    <div className={`chat-page ${isDark?"dark":"light"}`} style={{background:`url(${wallpaper}) center/cover no-repeat`}}>
      <div className="messages" ref={messagesRef} style={{overflowY:"auto", flexGrow:1}}>
        {messages.map(msg=>(
          <MessageBubble key={msg.id} msg={msg} myUid={myUid}/>
        ))}
        {localUploads.map(u=>(
          <MessageBubble key={u.id} msg={{...u,status:"uploading"}} myUid={myUid}/>
        ))}
        <div ref={endRef}/>
      </div>

      {showEmojiPicker && <AllEmojiPicker onSelect={e=>setText(t=>t+e)} onClose={()=>setShowEmojiPicker(false)}/>}

      <div className="input-bar">
        <button onClick={()=>setShowEmojiPicker(prev=>!prev)}>😊</button>
        <input type="text" value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message"/>
        <input type="file" multiple onChange={e=>{
          const files = Array.from(e.target.files);
          setSelectedFiles(prev=>[...prev,...files]);
          setPreviews(prev=>[...prev,...files.map(f=>f.type.startsWith("image/")?URL.createObjectURL(f):null)]);
        }}/>
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}