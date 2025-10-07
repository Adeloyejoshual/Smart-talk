/**
 * useBillingSocket.js
 *
 * React hook for connecting to billing server via Socket.IO
 * Handles: auth, joining call rooms, per-second updates,
 * and automatic call termination when funds are low.
 */

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const BILLING_SERVER_URL = import.meta.env.VITE_BILLING_SERVER_URL || "https://your-server-url.com";

export default function useBillingSocket({ idToken, callId, isCaller, onForceEnd, onBillingUpdate }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [billingActive, setBillingActive] = useState(false);

  useEffect(() => {
    if (!idToken || !callId) return;

    const socket = io(BILLING_SERVER_URL, { transports: ["websocket"], reconnection: true });
    socketRef.current = socket;

    // Authenticate immediately
    socket.on("connect", () => {
      socket.emit("auth", { idToken });
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setBillingActive(false);
    });

    socket.on("error", (err) => console.warn("Socket error:", err));

    // Auth success and join call room
    socket.on("auth", () => {
      setConnected(true);
      socket.emit("call:join", { callId });
    });

    // Billing updates every second
    socket.on("billing:update", (data) => {
      if (onBillingUpdate) onBillingUpdate(data);
    });

    // Server forced end (insufficient funds)
    socket.on("call:force-end", (data) => {
      if (onForceEnd) onForceEnd(data);
    });

    socket.on("call:ended", (data) => {
      setBillingActive(false);
      if (onForceEnd) onForceEnd(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [idToken, callId]);

  /** 🔹 Start billing when call actually starts (only caller should call this) */
  const startBilling = () => {
    if (!socketRef.current || !isCaller) return;
    socketRef.current.emit("billing:start", { callId });
    setBillingActive(true);
  };

  /** 🔹 Stop billing / end call normally */
  const stopBilling = (endedBy) => {
    if (!socketRef.current) return;
    socketRef.current.emit("billing:stop", { callId, endedBy });
    setBillingActive(false);
  };

  return {
    socket: socketRef.current,
    connected,
    billingActive,
    startBilling,
    stopBilling,
  };
}