import { useEffect, useRef } from "react";
import { io } from "socket.io-client"; // Explicit named import is recommended
import { getAuth } from "firebase/auth";

export default function useCallSocket({ type, targetUser, onConnected, onEnded }) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!targetUser?.id) return;

    let isMounted = true;

    async function initSocket() {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) throw new Error("No authenticated user");

        const token = await user.getIdToken();

        const socket = io("https://your-server.example.com", {
          auth: { token },
          transports: ["websocket"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("🔌 Socket connected");
          socket.emit("call:initiate", { to: targetUser.id, type });
        });

        socket.on("call:connected", () => {
          if (!isMounted) return;
          onConnected?.();
        });

        socket.on("call:end", (data) => {
          if (!isMounted) return;
          onEnded?.(data);
        });

        socket.on("call:low_balance", () => {
          alert("Low balance! Call will end shortly.");
          onEnded?.({ reason: "low_balance" });
        });

        socket.on("connect_error", (err) => {
          console.error("Socket connection error:", err);
        });
      } catch (err) {
        console.error("Failed to initialize call socket:", err);
      }
    }

    initSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [targetUser?.id, type, onConnected, onEnded]);

  function endCall() {
    socketRef.current?.emit("call:end", { reason: "user_hangup" });
  }

  return { socket: socketRef.current, endCall };
}