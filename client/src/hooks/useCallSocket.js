// /src/hooks/useCallSocket.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { db, auth } from "../firebaseClient";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function useCallSocket({ type, targetUser, onConnected, onEnded, onMissed }) {
  const socketRef = useRef(null);
  const me = auth.currentUser;

  useEffect(() => {
    if (!me || !targetUser?.uid) return;

    const socket = io("https://your-api.example.com", { transports: ["websocket"] });
    socketRef.current = socket;

    // 1️⃣ Register user socket
    socket.emit("register", { userId: me.uid });

    // 2️⃣ Initiate call
    socket.emit("call:initiate", {
      fromUserId: me.uid,
      toUserId: targetUser.uid,
      type,
    });

    // 3️⃣ Listen to events
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

  function endCall() {
    socketRef.current?.emit("call:end", { reason: "user_hangup" });
  }

  return { socket: socketRef.current, endCall };
}