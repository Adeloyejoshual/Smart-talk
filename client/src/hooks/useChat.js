import { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../firebaseClient";
import { getDatabase, ref as rtdbRef, onDisconnect, set, onValue } from "firebase/database";

export default function useChat(chatId, otherUserId) {
  const user = auth.currentUser;
  const uid = user?.uid;
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserStatus, setOtherUserStatus] = useState("offline");
  const [uploading, setUploading] = useState(false);
  const rtdb = getDatabase();

  // Listen to messages in Firestore ordered by timestamp (asc)
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatId]);

  // Presence tracking (Realtime Database)
  useEffect(() => {
    if (!uid || !otherUserId) return;

    const userStatusRef = rtdbRef(rtdb, `status/${uid}`);
    const connectedRef = rtdbRef(rtdb, ".info/connected");

    const handlePresence = (snap) => {
      if (snap.val() === false) return;
      onDisconnect(userStatusRef).set({
        state: "offline",
        lastChanged: Date.now(),
      });
      set(userStatusRef, {
        state: "online",
        lastChanged: Date.now(),
      });
    };

    const unsubPresence = onValue(connectedRef, handlePresence);

    // Track other user's status
    const otherStatusRef = rtdbRef(rtdb, `status/${otherUserId}`);
    const unsubOther = onValue(otherStatusRef, (snap) => {
      if (snap.exists()) setOtherUserStatus(snap.val().state);
    });

    return () => {
      unsubPresence();
      unsubOther();
    };
  }, [uid, otherUserId]);

  // Typing indicator: reset on disconnect
  useEffect(() => {
    if (!uid || !chatId) return;
    const typingRef = rtdbRef(rtdb, `typing/${chatId}/${uid}`);
    onDisconnect(typingRef).remove();
    return () => set(typingRef, false);
  }, [chatId, uid]);

  // Set current user's typing state
  const setTyping = async (state) => {
    if (!uid || !chatId) return;
    const typingRef = rtdbRef(rtdb, `typing/${chatId}/${uid}`);
    await set(typingRef, state);
  };

  // Listen to other user's typing state
  useEffect(() => {
    if (!chatId || !otherUserId) return;
    const typingRef = rtdbRef(rtdb, `typing/${chatId}/${otherUserId}`);
    const unsub = onValue(typingRef, (snap) => setIsTyping(!!snap.val()));
    return () => unsub();
  }, [chatId, otherUserId]);

  // Send text or generic message
  const sendMessage = async (text, type = "text") => {
    if (!chatId || !uid || !text.trim()) return;

    const msg = {
      senderId: uid,
      receiverId: otherUserId,
      text,
      type,
      timestamp: serverTimestamp(),
      seenBy: [uid],
      deletedFor: [],
      pinned: { isPinned: false, expiresAt: null },
      status: "sent", // maintaining compatibility with first version metadata
    };

    const msgRef = await addDoc(collection(db, "chats", chatId, "messages"), msg);

    // Update chat document metadata
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: msg,
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return msgRef.id;
  };

  // Upload media (image, file, audio) and send message with URL
  const sendMedia = async (file, type = "image") => {
    if (!file || !chatId || !uid) return;
    setUploading(true);

    const filePath = `chats/${chatId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    await sendMessage(downloadURL, type);

    setUploading(false);
  };

  // Send voice message as a .webm audio file via sendMedia
  const sendVoiceMessage = async (audioBlob) => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
    await sendMedia(file, "audio");
  };

  // Soft or hard delete message
  const deleteMessage = async (msgId, forEveryone = false) => {
    if (!chatId || !uid) return;
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;
    const msg = msgSnap.data();

    if (forEveryone) {
      // Permanently delete message document
      await deleteDoc(msgRef);
    } else {
      // Soft delete for current user only
      const updatedDeletedFor = [...(msg.deletedFor || []), uid];
      await updateDoc(msgRef, { deletedFor: updatedDeletedFor });
    }
  };

  // Pin message for a specific duration (default 24h)
  const pinMessage = async (msgId, duration = "24h") => {
    if (!chatId) return;
    const msgRef = doc(db, "chats", chatId, "messages", msgId);

    let hours = 24; // default
    if (duration === "3h") hours = 3;
    else if (duration === "7d") hours = 7 * 24;
    else if (duration === "30d") hours = 30 * 24;

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await updateDoc(msgRef, { pinned: { isPinned: true, expiresAt } });
  };

  // Unpin message
  const unpinMessage = async (msgId) => {
    if (!chatId) return;
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    await updateDoc(msgRef, { pinned: { isPinned: false, expiresAt: null } });
  };

  // Mark all messages as seen by current user
  const markAsSeen = useCallback(async () => {
    if (!chatId || !uid) return;

    const msgsRef = collection(db, "chats", chatId, "messages");
    const q = query(msgsRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, async (snap) => {
      for (const d of snap.docs) {
        const msg = d.data();
        if (!msg.seenBy?.includes(uid)) {
          await updateDoc(d.ref, { seenBy: [...(msg.seenBy || []), uid] });
        }
      }
    });

    return () => unsub();
  }, [chatId, uid]);

  return {
    messages,
    sendMessage,
    sendMedia,
    sendVoiceMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    markAsSeen,
    setTyping,
    isTyping,
    otherUserStatus,
    uploading,
  };
}