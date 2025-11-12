// src/utils/createOrGetChat.js
import { db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * ✅ Create or return an existing chat between two users.
 * @param {string} currentUserId - ID of the logged-in user
 * @param {string} otherUserId - ID of the person they’re chatting with
 * @returns {Promise<string>} - chatId
 */
export async function createOrGetChat(currentUserId, otherUserId) {
  if (!currentUserId || !otherUserId) throw new Error("Missing user IDs");

  const chatsRef = collection(db, "chats");

  // 🔍 Check if chat already exists for these two users
  const q = query(
    chatsRef,
    where("participants", "array-contains", currentUserId)
  );
  const querySnapshot = await getDocs(q);

  let existingChatId = null;
  querySnapshot.forEach((docSnap) => {
    const participants = docSnap.data().participants || [];
    if (participants.includes(otherUserId)) {
      existingChatId = docSnap.id;
    }
  });

  if (existingChatId) return existingChatId;

  // 🆕 Otherwise create a new chat document
  const newChatRef = await addDoc(chatsRef, {
    participants: [currentUserId, otherUserId],
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  return newChatRef.id;
}