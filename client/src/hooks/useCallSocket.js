import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { db, auth } from "../firebaseClient";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";

export default function useCallSocket({
  type,
  targetUser,
  onConnected,
  onEnded,
  onMissed,
  peerConnection,
  callData,
  endCall,
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const lastDeductRef = useRef(0);
  const socketRef = useRef(null);
  const me = auth.currentUser;

  const COST_PER_SECOND = 0.0033; // Adjust as needed

  // Initialize and manage socket connection, call signaling
  useEffect(() => {
    if (!me || !targetUser?.uid) return;

    const socket = io("https://your-api.example.com", { transports: ["websocket"] });
    socketRef.current = socket;

    socket.emit("register", { userId: me.uid });

    socket.emit("call:initiate", {
      fromUserId: me.uid,
      toUserId: targetUser.uid,
      type,
    });

    socket.on("call:connected", async ({ callId }) => {
      await updateDoc(doc(db, "calls", callId), { status: "active", startedAt: serverTimestamp() });
      onConnected?.();
    });

    socket.on("call:missed", async ({ callId }) => {
      await updateDoc(doc(db, "calls", callId), { status: "missed", endedAt: serverTimestamp() });
      onMissed?.();
    });

    socket.on("call:end", async ({ callId, reason }) => {
      await updateDoc(doc(db, "calls", callId), { status: "ended", endedAt: serverTimestamp() });
      onEnded?.(reason);
    });

    socket.on("connect_error", (err) => console.error("Socket error:", err));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me, targetUser?.uid, type]);

  // Timer and wallet deduction every 5 seconds
  useEffect(() => {
    if (!callData?.active) return;

    timerRef.current = setInterval(async () => {
      setElapsed((prev) => prev + 1);

      const now = Math.floor(Date.now() / 1000);
      if (now - lastDeductRef.current >= 5) {
        lastDeductRef.current = now;
        await deductBalance(5 * COST_PER_SECOND);
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [callData]);

  // Deduct balance safely from Firestore wallet
  async function deductBalance(amount) {
    if (!me) return;
    const walletRef = doc(db, "wallets", me.uid);
    const snap = await getDoc(walletRef);
    if (!snap.exists()) return;

    const currentBalance = snap.data().balance || 0;

    if (currentBalance < amount) {
      clearInterval(timerRef.current);
      await updateDoc(walletRef, { balance: 0 });
      alert("⚠️ Call ended due to insufficient balance.");
      handleEndCall();
      return;
    }

    await updateDoc(walletRef, {
      balance: increment(-amount),
      lastUpdated: serverTimestamp(),
    });
  }

  // Save call billing record on call end
  async function saveCallRecord(duration) {
    if (!me || !callData) return;

    const totalCost = +(duration * COST_PER_SECOND).toFixed(2);

    await addDoc(collection(db, "calls"), {
      callerId: callData.callerId,
      calleeId: callData.calleeId,
      callerName: callData.callerName,
      calleeName: callData.calleeName,
      type: callData.type,
      duration,
      cost: totalCost,
      status: "ended",
      timestamp: serverTimestamp(),
    });
  }

  // Cleanup timer, save billing info, and end call
  function handleEndCall() {
    clearInterval(timerRef.current);
    saveCallRecord(elapsed);
    endCall();
  }

  return {
    elapsed,
    handleEndCall,
    socket: socketRef.current,
    endCall,
  };
}