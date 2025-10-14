// src/utils/saveCallHistory.js
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Save call history to Firestore
 * 
 * @param {Object} callData - Information about the call
 * @param {string} callData.callerId - UID of the caller
 * @param {string} callData.callerName - Display name of the caller
 * @param {string} callData.receiverId - UID of the receiver
 * @param {string} callData.receiverName - Display name of the receiver
 * @param {string} callData.status - Call status: "outgoing" | "answered" | "missed" | "ended"
 * @param {number} [callData.startTime] - Timestamp when the call started
 * @param {number} [callData.endTime] - Timestamp when the call ended
 * @param {number} [callData.duration] - Duration in seconds
 */
export async function saveCallHistory(callData) {
  try {
    await addDoc(collection(db, "callHistory"), {
      callerId: callData.callerId,
      callerName: callData.callerName,
      receiverId: callData.receiverId,
      receiverName: callData.receiverName,
      status: callData.status || "unknown",
      startTime: callData.startTime || null,
      endTime: callData.endTime || null,
      duration: callData.duration || null,
      timestamp: serverTimestamp(),
    });
    console.log("📞 Call history saved:", callData.status);
  } catch (error) {
    console.error("❌ Error saving call history:", error);
  }
}