import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Saves a call record to Firestore callHistory collection
 */
export const saveCallHistory = async (data) => {
  try {
    await addDoc(collection(db, "callHistory"), {
      callerId: data.callerId,
      callerName: data.callerName,
      receiverId: data.receiverId,
      receiverName: data.receiverName,
      status: data.status, // "answered" | "missed" | "outgoing"
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      duration: data.duration || 0,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error saving call history:", err);
  }
};