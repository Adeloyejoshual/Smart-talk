import React, { useState } from "react";
import { getAuth } from "firebase/auth";

const AdminBroadcast = () => {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const handleBroadcast = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return setStatus("Please log in as admin first.");

      const token = await user.getIdToken();

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("✅ Message sent to all users!");
        setMessage("");
      } else {
        setStatus("⚠️ Failed: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      setStatus("❌ Error: " + err.message);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Broadcast Message</h1>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="border w-full p-3 rounded mb-3"
        placeholder="Enter your announcement..."
      />
      <button
        onClick={handleBroadcast}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        Send Broadcast
      </button>
      {status && <p className="mt-3 text-center">{status}</p>}
    </div>
  );
};

export default AdminBroadcast;
