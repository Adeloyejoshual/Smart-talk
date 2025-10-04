import React, { useState } from "react";
import { startCall, endCall } from "../utils/api/call";

const CallDemo = () => {
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("");

  const handleStart = async () => {
    try {
      setStatus("Starting call...");
      const sid = await startCall(["friend123"], "host123");
      setSessionId(sid);
      setStatus(`✅ Call started: ${sid}`);
    } catch (e) {
      setStatus("❌ " + e.message);
    }
  };

  const handleEnd = async () => {
    try {
      if (!sessionId) return setStatus("No active call");
      setStatus("Ending call...");
      const result = await endCall(sessionId);
      setStatus(
        `✅ Call ended — Duration: ${result.session.durationSec}s, Charge: $${result.session.charge}`
      );
      setSessionId(null);
    } catch (e) {
      setStatus("❌ " + e.message);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-xl font-bold mb-4">Call Session Test</h1>
      {!sessionId ? (
        <button
          onClick={handleStart}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Start Call
        </button>
      ) : (
        <button
          onClick={handleEnd}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          End Call
        </button>
      )}
      <p className="mt-4">{status}</p>
    </div>
  );
};

export default CallDemo;
