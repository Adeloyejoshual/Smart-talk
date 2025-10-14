import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

export const saveCallHistory = async (callData) => {
  try {
    await addDoc(collection(db, "callHistory"), {
      callerId: callData.callerId,
      callerName: callData.callerName,
      receiverId: callData.receiverId,
      receiverName: callData.receiverName,
      status: callData.status, // "missed" | "answered" | "outgoing"
      startTime: callData.startTime || null,
      endTime: callData.endTime || null,
      duration: callData.duration || 0,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ Error saving call history:", error);
  }
};