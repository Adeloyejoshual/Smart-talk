// /src/hooks/useCallSocket.js
import { useEffect, useRef } from "react";
import io from "socket.io-client";
import { auth } from "../firebaseClient";

export default function useCallSocket({ onConnected, onEnded, type = "voice", targetUser }) {
  const socketRef = useRef(null);

  useEffect(() => {
    const initSocket = async () => {
      const token = await auth.currentUser.getIdToken();
      const socket = io(import.meta.env.VITE_SERVER_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      socket.on("connect", () => {
        console.log("🔌 Socket connected");
        socket.emit("call:start", { to: targetUser.uid, type });
      });

      socket.on("call:connected", () => {
        console.log("✅ Call connected");
        onConnected?.();
      });

      socket.on("call:end", (reason) => {
        console.log("❌ Call ended:", reason);
        onEnded?.(reason);
      });

      socketRef.current = socket;
    };

    initSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [targetUser, type]);

  const endCall = () => {
    socketRef.current?.emit("call:end", { reason: "user_hangup" });
  };

  return { socket: socketRef.current, endCall };
}